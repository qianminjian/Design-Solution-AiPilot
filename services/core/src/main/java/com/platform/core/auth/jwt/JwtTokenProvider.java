package com.platform.core.auth.jwt;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSSigner;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.platform.core.common.config.AppProperties;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.text.ParseException;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * JWT Token 生成与验证工具
 *
 * 算法：HS256（对称签名，密钥从 app.security.jwt-secret 读取）
 * claims：sub(principalId) / tenant_id / email / roles / type / iat / exp
 *
 * 安全约束（见 security.md §2.2）：
 * - access token 有效期 ≤ 15 分钟
 * - refresh token 有效期 ≤ 7 天
 * - 密钥不得打印到日志
 */
@Component
public class JwtTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenProvider.class);

    /** Token 类型：access / refresh */
    public static final String TYPE_ACCESS = "access";
    public static final String TYPE_REFRESH = "refresh";

    /** claims key */
    private static final String CLAIM_TENANT_ID = "tenant_id";
    private static final String CLAIM_EMAIL = "email";
    private static final String CLAIM_ROLES = "roles";
    private static final String CLAIM_TYPE = "type";

    /** access token 默认有效期：15 分钟（security.md §2.2 上限） */
    private static final Duration DEFAULT_ACCESS_EXPIRE = Duration.ofMinutes(15);
    /** refresh token 默认有效期：7 天（security.md §2.2 上限） */
    private static final Duration DEFAULT_REFRESH_EXPIRE = Duration.ofDays(7);

    /** HS256 密钥最小字节数（RFC 7518 §3.2 要求 ≥ 256 位 = 32 字节） */
    private static final int MIN_SECRET_BYTES = 32;

    private final AppProperties appProperties;
    private JWSSigner signer;
    private JWSVerifier verifier;
    private Duration accessExpire;
    private Duration refreshExpire;

    public JwtTokenProvider(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    /**
     * 启动时校验密钥强度并初始化签名器
     * 缺失或弱密钥直接拒绝启动（security.md §1）
     */
    @PostConstruct
    void init() {
        String secret = appProperties.getSecurity().getJwtSecret();
        if (secret == null || secret.getBytes().length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "app.security.jwt-secret 长度不足，HS256 要求至少 32 字节");
        }
        try {
            byte[] secretBytes = secret.getBytes();
            this.signer = new MACSigner(secretBytes);
            this.verifier = new MACVerifier(secretBytes);
            this.accessExpire = parseDuration(appProperties.getSecurity().getAccessTokenExpire(),
                    DEFAULT_ACCESS_EXPIRE);
            this.refreshExpire = parseDuration(appProperties.getSecurity().getRefreshTokenExpire(),
                    DEFAULT_REFRESH_EXPIRE);
        } catch (JOSEException ex) {
            throw new IllegalStateException("初始化 JWT 签名器失败", ex);
        }
    }

    /**
     * 生成 access token
     *
     * @param principalId 主体 ID（写入 sub）
     * @param tenantId    租户 ID
     * @param email       邮箱
     * @param roles       角色代码列表
     * @return 已签名的 JWT 字符串
     */
    public String generateAccessToken(UUID principalId, UUID tenantId, String email, List<String> roles) {
        Instant now = Instant.now();
        JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
                .subject(principalId.toString())
                .jwtID(UUID.randomUUID().toString())
                .claim(CLAIM_TENANT_ID, tenantId.toString())
                .claim(CLAIM_TYPE, TYPE_ACCESS)
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plus(accessExpire)));
        if (email != null) {
            builder.claim(CLAIM_EMAIL, email);
        }
        if (roles != null && !roles.isEmpty()) {
            builder.claim(CLAIM_ROLES, roles);
        }
        return sign(builder.build());
    }

    /**
     * 生成 refresh token
     * 不包含 email/roles，降低泄露风险；刷新时重新拉取
     */
    public String generateRefreshToken(UUID principalId, UUID tenantId) {
        Instant now = Instant.now();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(principalId.toString())
                .claim(CLAIM_TENANT_ID, tenantId.toString())
                .claim(CLAIM_TYPE, TYPE_REFRESH)
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plus(refreshExpire)))
                .build();
        return sign(claims);
    }

    /**
     * 验证 token 签名 + 有效期
     * 验证失败抛业务异常（不暴露具体原因给客户端，统一由调用方处理）
     */
    public void validateToken(String token) {
        SignedJWT jwt = parse(token);
        try {
            if (!jwt.verify(verifier)) {
                throw new BusinessException(ErrorCode.TOKEN_INVALID, HttpStatus.UNAUTHORIZED,
                        "Token 无效");
            }
        } catch (JOSEException ex) {
            log.warn("Token 签名校验异常 traceId={}", org.slf4j.MDC.get("traceId"), ex);
            throw new BusinessException(ErrorCode.TOKEN_INVALID, HttpStatus.UNAUTHORIZED,
                    "Token 无效");
        }
        try {
            if (jwt.getJWTClaimsSet().getExpirationTime().before(Date.from(Instant.now()))) {
                throw new BusinessException(ErrorCode.TOKEN_EXPIRED, HttpStatus.UNAUTHORIZED,
                        "Token 已过期");
            }
        } catch (ParseException ex) {
            throw new BusinessException(ErrorCode.TOKEN_INVALID, HttpStatus.UNAUTHORIZED,
                    "Token 无效");
        }
    }

    /**
     * 从 token 提取 principalId（sub claim）
     */
    public UUID getPrincipalIdFromToken(String token) {
        return UUID.fromString(getClaim(token, JWTClaimsSet::getSubject));
    }

    /**
     * 从 token 提取 tenantId
     */
    public UUID getTenantIdFromToken(String token) {
        String raw = getClaim(token, c -> c.getStringClaim(CLAIM_TENANT_ID));
        return UUID.fromString(raw);
    }

    /**
     * 从 token 提取类型（access / refresh）
     */
    public String getTokenType(String token) {
        return getClaim(token, c -> c.getStringClaim(CLAIM_TYPE));
    }

    /**
     * 从 token 提取邮箱
     * refresh token 不含 email，返回 null
     */
    public String getEmailFromToken(String token) {
        return getClaim(token, c -> c.getStringClaim(CLAIM_EMAIL));
    }

    /**
     * 从 token 提取 roles
     */
    @SuppressWarnings("unchecked")
    public List<String> getRolesFromToken(String token) {
        Object raw = getClaim(token, c -> c.getClaim(CLAIM_ROLES));
        if (raw instanceof List<?> list) {
            return (List<String>) list;
        }
        return List.of();
    }

    /**
     * 从 token 提取 jti（会话 ID）
     */
    public String getSessionIdFromToken(String token) {
        return getClaim(token, JWTClaimsSet::getJWTID);
    }

    /**
     * 从 token 提取签发时间
     */
    public Instant getIssuedAtFromToken(String token) {
        Date date = getClaim(token, JWTClaimsSet::getIssueTime);
        return date != null ? date.toInstant() : null;
    }

    /**
     * 从 token 提取过期时间
     */
    public Instant getExpiresAtFromToken(String token) {
        Date date = getClaim(token, JWTClaimsSet::getExpirationTime);
        return date != null ? date.toInstant() : null;
    }

    /**
     * 获取 access token 有效期（秒），用于响应体回传给客户端
     */
    public long getAccessTokenExpiresInSeconds() {
        return accessExpire.toSeconds();
    }

    /**
     * 获取 refresh token 有效期（秒），用于 cookie maxAge
     */
    public long getRefreshTokenExpiresInSeconds() {
        return refreshExpire.toSeconds();
    }

    // ── 内部辅助 ──

    private String sign(JWTClaimsSet claims) {
        try {
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            jwt.sign(signer);
            return jwt.serialize();
        } catch (JOSEException ex) {
            log.error("JWT 签名失败", ex);
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR,
                    "Token 生成失败");
        }
    }

    private SignedJWT parse(String token) {
        try {
            return SignedJWT.parse(token);
        } catch (ParseException ex) {
            throw new BusinessException(ErrorCode.TOKEN_INVALID, HttpStatus.UNAUTHORIZED,
                    "Token 无效");
        }
    }

    private <T> T getClaim(String token, ClaimsExtractor<T> extractor) {
        SignedJWT jwt = parse(token);
        try {
            return extractor.extract(jwt.getJWTClaimsSet());
        } catch (ParseException ex) {
            throw new BusinessException(ErrorCode.TOKEN_INVALID, HttpStatus.UNAUTHORIZED,
                    "Token 无效");
        }
    }

    @FunctionalInterface
    private interface ClaimsExtractor<T> {
        T extract(JWTClaimsSet claims) throws ParseException;
    }

    /**
     * 解析 Duration 字符串：支持 15m / 7d / 1h / 30s 等后缀
     * 无法解析时返回默认值（不抛异常，避免阻断启动）
     */
    private static Duration parseDuration(String raw, Duration fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        String trimmed = raw.trim().toLowerCase();
        try {
            if (trimmed.endsWith("ms")) {
                return Duration.ofMillis(Long.parseLong(trimmed.substring(0, trimmed.length() - 2)));
            }
            if (trimmed.endsWith("s")) {
                return Duration.ofSeconds(Long.parseLong(trimmed.substring(0, trimmed.length() - 1)));
            }
            if (trimmed.endsWith("m")) {
                return Duration.ofMinutes(Long.parseLong(trimmed.substring(0, trimmed.length() - 1)));
            }
            if (trimmed.endsWith("h")) {
                return Duration.ofHours(Long.parseLong(trimmed.substring(0, trimmed.length() - 1)));
            }
            if (trimmed.endsWith("d")) {
                return Duration.ofDays(Long.parseLong(trimmed.substring(0, trimmed.length() - 1)));
            }
            return Duration.ofSeconds(Long.parseLong(trimmed));
        } catch (NumberFormatException ex) {
            log.warn("无法解析 duration={}，使用默认值", raw);
            return fallback;
        }
    }
}
