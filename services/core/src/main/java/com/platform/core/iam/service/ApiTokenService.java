package com.platform.core.iam.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.security.AuthenticatedPrincipal;
import com.platform.core.iam.domain.ApiToken;
import com.platform.core.iam.dto.ApiTokenDto;
import com.platform.core.iam.dto.CreateApiTokenRequest;
import com.platform.core.iam.dto.CreateApiTokenResponse;
import com.platform.core.iam.dto.RevokeApiTokenRequest;
import com.platform.core.iam.repository.ApiTokenRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * IAM API Token 应用服务
 *
 * <p>设计：
 * <ul>
 *   <li>listMyTokens：查询当前用户的所有 Token（不含明文）</li>
 *   <li>createToken：生成明文 token + 独立盐 + SHA-256 哈希，仅本次返回明文</li>
 *   <li>revokeToken：软撤销（status=revoked），不删除记录保留审计</li>
 * </ul>
 *
 * <p>安全红线（security.md §1）：
 * <ul>
 *   <li>principalId 仅从 SecurityContext 获取，不读取 x-user-id 请求头</li>
 *   <li>明文 token 仅在创建响应中返回一次，DB 中仅存哈希</li>
 *   <li>每个 token 独立盐值，防止彩虹表攻击</li>
 *   <li>过期时间强制 ≤ 90 天</li>
 *   <li>撤销不可逆，仅更新 status，保留审计追溯</li>
 * </ul>
 */
@Service
public class ApiTokenService {

    private static final Logger log = LoggerFactory.getLogger(ApiTokenService.class);

    /** Token 最大有效期：90 天（security.md §1 PAT 允许 ≤ 90 天） */
    private static final Duration MAX_TOKEN_TTL = Duration.ofDays(90);

    /** 明文 token 长度：32 字节 = 64 个十六进制字符 */
    private static final int TOKEN_BYTES = 32;

    /** 前缀展示长度：12 字符 */
    private static final int PREFIX_LENGTH = 12;

    /** 盐值长度：16 字节 = 32 个十六进制字符 */
    private static final int SALT_BYTES = 16;

    private final ApiTokenRepository repository;
    private final ObjectMapper objectMapper;

    public ApiTokenService(ApiTokenRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    /**
     * 查询当前用户的所有 Token（按创建时间倒序）
     */
    @Transactional(readOnly = true)
    public List<ApiTokenDto> listMyTokens() {
        AuthenticatedPrincipal auth = currentPrincipalOrThrow();
        return repository.findByPrincipalIdOrderByCreatedAtDesc(auth.principalId())
                .stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * 创建新 Token
     *
     * <p>返回包含明文 token 的响应（仅本次返回），DB 中仅存哈希。
     */
    @Transactional
    public CreateApiTokenResponse createToken(CreateApiTokenRequest request) {
        AuthenticatedPrincipal auth = currentPrincipalOrThrow();

        // 1. 解析并校验过期时间
        Instant expiresAt = Instant.parse(request.expiresAt());
        Instant now = Instant.now();
        if (expiresAt.isBefore(now.plusSeconds(60))) {
            throw new IllegalArgumentException("过期时间必须晚于当前时间至少 60 秒");
        }
        if (expiresAt.isAfter(now.plus(MAX_TOKEN_TTL))) {
            throw new IllegalArgumentException("Token 有效期不能超过 90 天");
        }

        // 2. 校验名称唯一性（同主体下 active 状态 Token 名称不重复）
        repository.findByPrincipalIdAndNameAndStatus(
                auth.principalId(), request.name(), "active"
        ).ifPresent(existing -> {
            throw new IllegalStateException("Token 名称已存在: " + request.name());
        });

        // 3. 生成明文 token（32 字节随机数 → 64 位十六进制字符串）
        String plainToken = generatePlainToken();

        // 4. 生成独立盐值（16 字节 → 32 位十六进制字符串）
        String salt = generateSalt();

        // 5. 计算 SHA-256 + 盐哈希
        String tokenHash = hashToken(plainToken, salt);

        // 6. 序列化 scopes 为 JSON
        String scopesJson = serializeScopes(request.scopes());

        // 7. 构建实体并保存
        ApiToken entity = new ApiToken();
        entity.setPrincipalId(auth.principalId());
        entity.setTenantId(auth.tenantId());
        entity.setName(request.name());
        entity.setPrefix(plainToken.substring(0, PREFIX_LENGTH));
        entity.setTokenHash(tokenHash);
        entity.setTokenSalt(salt);
        entity.setScopes(scopesJson);
        entity.setStatus("active");
        entity.setExpiresAt(expiresAt);

        ApiToken saved = repository.save(entity);
        log.info("API Token 创建成功 principalId={} tokenId={} name={} expiresAt={}",
                auth.principalId(), saved.getId(), saved.getName(), saved.getExpiresAt());

        return new CreateApiTokenResponse(
                saved.getId(),
                saved.getPrincipalId(),
                saved.getName(),
                saved.getPrefix(),
                plainToken,
                request.scopes(),
                saved.getStatus(),
                saved.getExpiresAt(),
                saved.getCreatedAt()
        );
    }

    /**
     * 撤销 Token（软撤销，保留审计追溯）
     */
    @Transactional
    public ApiTokenDto revokeToken(UUID tokenId, RevokeApiTokenRequest request) {
        AuthenticatedPrincipal auth = currentPrincipalOrThrow();
        ApiToken entity = repository.findById(tokenId)
                .orElseThrow(() -> new IllegalArgumentException("Token 不存在: " + tokenId));

        // 安全：仅能撤销自己的 Token
        if (!entity.getPrincipalId().equals(auth.principalId())) {
            log.warn("拒绝撤销他人 Token principalId={} tokenId={} owner={}",
                    auth.principalId(), tokenId, entity.getPrincipalId());
            throw new IllegalStateException("无权撤销他人的 Token");
        }

        if ("revoked".equals(entity.getStatus())) {
            throw new IllegalStateException("Token 已撤销，不可重复操作");
        }

        entity.setStatus("revoked");
        entity.setRevokedAt(Instant.now());
        entity.setRevokedReason(request.reason());

        ApiToken saved = repository.save(entity);
        log.info("API Token 撤销成功 principalId={} tokenId={} reason={}",
                auth.principalId(), tokenId, request.reason());
        return toDto(saved);
    }

    // ===== 内部辅助方法 =====

    private AuthenticatedPrincipal currentPrincipalOrThrow() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("未找到认证上下文，无法解析当前主体");
        }
        Object principal = authentication.getPrincipal();
        if (!(principal instanceof AuthenticatedPrincipal authenticated)) {
            throw new IllegalStateException(
                    "认证主体类型不匹配，期望 AuthenticatedPrincipal 实际: "
                            + (principal != null ? principal.getClass().getName() : "null"));
        }
        return authenticated;
    }

    private String generatePlainToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String generateSalt() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[SALT_BYTES];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    /**
     * SHA-256(token + ":" + salt) → 64 位十六进制字符串
     *
     * <p>安全：盐值与 token 拼接后哈希，防止彩虹表攻击。
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

    private String serializeScopes(List<String> scopes) {
        try {
            return objectMapper.writeValueAsString(scopes);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("scopes 序列化失败", e);
        }
    }

    private List<String> deserializeScopes(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            log.warn("scopes 反序列化失败，返回空列表 json={}", json, e);
            return List.of();
        }
    }

    private ApiTokenDto toDto(ApiToken entity) {
        return new ApiTokenDto(
                entity.getId(),
                entity.getPrincipalId(),
                entity.getName(),
                entity.getPrefix(),
                deserializeScopes(entity.getScopes()),
                entity.getStatus(),
                entity.getExpiresAt(),
                entity.getLastUsedAt(),
                entity.getRevokedAt(),
                entity.getRevokedReason(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getRowVersion()
        );
    }
}
