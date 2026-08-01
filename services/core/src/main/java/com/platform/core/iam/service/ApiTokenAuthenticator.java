package com.platform.core.iam.service;

import com.platform.core.common.security.AuthenticatedPrincipal;
import com.platform.core.iam.domain.ApiToken;
import com.platform.core.iam.repository.ApiTokenRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * IAM API Token 认证器（P0-16.1 Token 认证中间件）
 *
 * <p>职责：
 * <ul>
 *   <li>验证 PAT（Personal Access Token）明文 token</li>
 *   <li>返回 {@link AuthenticatedPrincipal} 用于注入 SecurityContext</li>
 *   <li>更新 last_used_at（V0 同步更新，V1 优化为异步批量）</li>
 * </ul>
 *
 * <p>认证流程（对齐 A-62/A-63/A-64 IAM Token 全生命周期）：
 * <ol>
 *   <li>取明文 token 前 12 位作为 prefix 查询候选 Token（status=active）</li>
 *   <li>对每个候选 Token，用其 tokenSalt 计算 SHA-256(salt + ":" + plainToken)</li>
 *   <li>比对计算结果与候选 Token 的 tokenHash，匹配则认证成功</li>
 *   <li>校验 expiresAt 未过期（A-64 自动过期清理为兜底，认证时再次校验防止时间窗口）</li>
 *   <li>更新 lastUsedAt（V0 同步更新，V1 优化为异步批量）</li>
 *   <li>构建 AuthenticatedPrincipal 注入 SecurityContext</li>
 * </ol>
 *
 * <p>安全红线（security.md §1 + §2.2）：
 * <ul>
 *   <li>明文 token 仅在认证时使用，不落日志、不存 DB</li>
 *   <li>每个 token 独立盐值，防止彩虹表攻击</li>
 *   <li>认证失败不抛异常，返回 Optional.empty()，让 Security 链以匿名身份继续</li>
 *   <li>lastUsedAt 更新失败不阻断认证（仅记录日志）</li>
 * </ul>
 *
 * <p>V0 限制：
 * <ul>
 *   <li>不查询 Principal 表填充 email（V1 接入）</li>
 *   <li>不查询 RoleBinding 表填充 roles（V1 接入 scope-based 授权）</li>
 *   <li>sessionId 固定为 "pat:" + token.id（V1 接入会话管理）</li>
 *   <li>lastUsedAt 同步更新（V1 优化为异步批量，避免每次 API 调用都写库）</li>
 * </ul>
 */
@Service
public class ApiTokenAuthenticator {

    private static final Logger log = LoggerFactory.getLogger(ApiTokenAuthenticator.class);

    /** Token 前缀长度（与 ApiTokenService.PREFIX_LENGTH 一致） */
    private static final int PREFIX_LENGTH = 12;

    /** PAT 明文 token 长度（与 ApiTokenService.TOKEN_BYTES 一致：32 字节 = 64 位十六进制） */
    private static final int PAT_TOKEN_LENGTH = 64;

    private final ApiTokenRepository repository;

    public ApiTokenAuthenticator(ApiTokenRepository repository) {
        this.repository = repository;
    }

    /**
     * 认证 PAT
     *
     * @param plainToken 明文 token（64 位十六进制字符串）
     * @return 认证成功返回 {@link AuthenticatedPrincipal}，失败返回 empty
     */
    @Transactional
    public Optional<AuthenticatedPrincipal> authenticate(String plainToken) {
        if (!isValidPatFormat(plainToken)) {
            log.debug("PAT 格式无效 length={}", plainToken == null ? 0 : plainToken.length());
            return Optional.empty();
        }

        String prefix = plainToken.substring(0, PREFIX_LENGTH);
        List<ApiToken> candidates = repository.findByPrefixAndStatus(prefix, "active");
        if (candidates.isEmpty()) {
            log.debug("PAT 未匹配到候选 Token prefix={}", prefix);
            return Optional.empty();
        }

        Instant now = Instant.now();
        for (ApiToken candidate : candidates) {
            String computedHash = hashToken(plainToken, candidate.getTokenSalt());
            if (!computedHash.equals(candidate.getTokenHash())) {
                continue;
            }

            // 哈希匹配，校验未过期（A-64 自动清理为兜底，认证时再次校验防止时间窗口）
            if (candidate.getExpiresAt().isBefore(now)) {
                log.warn("PAT 已过期但状态仍为 active tokenId={} principalId={} expiresAt={}",
                        candidate.getId(), candidate.getPrincipalId(), candidate.getExpiresAt());
                return Optional.empty();
            }

            // 更新 lastUsedAt（V0 同步更新，V1 优化为异步批量）
            updateLastUsedAt(candidate, now);

            AuthenticatedPrincipal principal = buildPrincipal(candidate);
            log.info("PAT 认证成功 principalId={} tokenId={} prefix={}",
                    candidate.getPrincipalId(), candidate.getId(), prefix);
            return Optional.of(principal);
        }

        log.debug("PAT 哈希比对不匹配 prefix={} candidateCount={}", prefix, candidates.size());
        return Optional.empty();
    }

    /**
     * 校验 PAT 明文 token 格式
     *
     * <p>格式：64 位十六进制字符串（小写）。
     * 用于区分 JWT（xxx.yyy.zzz 格式，含两个点分隔符）。
     *
     * @param plainToken 待校验的明文 token
     * @return 格式合法返回 true
     */
    public boolean isValidPatFormat(String plainToken) {
        if (plainToken == null || plainToken.length() != PAT_TOKEN_LENGTH) {
            return false;
        }
        for (int i = 0; i < PAT_TOKEN_LENGTH; i++) {
            char c = plainToken.charAt(i);
            if (!isHexChar(c)) {
                return false;
            }
        }
        return true;
    }

    /**
     * SHA-256(salt + ":" + token) → 64 位十六进制字符串
     *
     * <p>与 {@link ApiTokenService#hashToken} 算法一致，确保哈希可比对。
     */
    private String hashToken(String token, String salt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest((salt + ":" + token).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            log.error("SHA-256 algorithm not available in JRE", e);
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    /**
     * 更新 lastUsedAt（V0 同步更新）
     *
     * <p>V1 优化：改为异步批量更新，避免每次 API 调用都写库。
     * V0 简化实现：直接 save，更新失败仅记录日志不阻断认证。
     */
    private void updateLastUsedAt(ApiToken token, Instant now) {
        try {
            token.setLastUsedAt(now);
            repository.save(token);
        } catch (Exception e) {
            log.warn("更新 lastUsedAt 失败 tokenId={} cause={}", token.getId(), e.getMessage());
        }
    }

    /**
     * 构建 AuthenticatedPrincipal
     *
     * <p>V0 限制：
     * <ul>
     *   <li>email = null（V1 查询 Principal 表填充）</li>
     *   <li>roles = 空列表（V1 查询 RoleBinding 表填充，或接入 scope-based 授权）</li>
     *   <li>sessionId = "pat:" + tokenId（V1 接入会话管理）</li>
     * </ul>
     */
    private AuthenticatedPrincipal buildPrincipal(ApiToken token) {
        return new AuthenticatedPrincipal(
                token.getPrincipalId(),
                token.getTenantId(),
                null,
                List.of(),
                "pat:" + token.getId(),
                token.getCreatedAt(),
                token.getExpiresAt()
        );
    }

    private boolean isHexChar(char c) {
        return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
    }
}
