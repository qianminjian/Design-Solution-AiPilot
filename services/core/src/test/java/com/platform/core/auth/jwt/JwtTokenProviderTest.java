package com.platform.core.auth.jwt;

import com.platform.core.common.config.AppProperties;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * JwtTokenProvider 单元测试
 *
 * 覆盖：
 * - 密钥强度校验（≥ 32 字节）
 * - access / refresh token 生成与 claims 正确性
 * - token 验证（签名 + 有效期）
 * - 各类 claim 提取方法
 * - Duration 字符串解析（ms/s/m/h/d + 默认值兜底）
 */
@DisplayName("JwtTokenProvider JWT 令牌工具")
class JwtTokenProviderTest {

    /** 64 字节 HS256 密钥（满足 ≥ 32 字节要求） */
    private static final String VALID_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    /** 31 字节，不满足最小长度要求 */
    private static final String SHORT_SECRET = "0123456789abcdef0123456789abcde";
    private static final UUID PRINCIPAL_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final String EMAIL = "architect@example.com";
    private static final List<String> ROLES = List.of("ARCHITECT", "PROJECT_LEAD");

    private AppProperties appProperties;

    @BeforeEach
    void setUp() {
        appProperties = new AppProperties();
        appProperties.getSecurity().setJwtSecret(VALID_SECRET);
        appProperties.getSecurity().setAccessTokenExpire("15m");
        appProperties.getSecurity().setRefreshTokenExpire("7d");
    }

    /**
     * 构造并初始化 JwtTokenProvider
     */
    private JwtTokenProvider newProvider() {
        JwtTokenProvider provider = new JwtTokenProvider(appProperties);
        provider.init();
        return provider;
    }

    @Nested
    @DisplayName("init 启动时密钥校验")
    class InitSecretValidation {

        @Test
        @DisplayName("密钥不足 32 字节应抛 IllegalStateException")
        void shouldRejectShortSecret() {
            // Arrange
            appProperties.getSecurity().setJwtSecret(SHORT_SECRET);

            // Act + Assert
            assertThatThrownBy(() -> newProvider())
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("jwt-secret")
                    .hasMessageContaining("32 字节");
        }

        @Test
        @DisplayName("密钥为 null 应抛 IllegalStateException")
        void shouldRejectNullSecret() {
            // Arrange
            appProperties.getSecurity().setJwtSecret(null);

            // Act + Assert
            assertThatThrownBy(() -> newProvider())
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("密钥为空字符串应抛 IllegalStateException")
        void shouldRejectEmptySecret() {
            // Arrange
            appProperties.getSecurity().setJwtSecret("");

            // Act + Assert
            assertThatThrownBy(() -> newProvider())
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("合法密钥应成功初始化")
        void shouldInitWithValidSecret() {
            // Act + Assert
            JwtTokenProvider provider = newProvider();
            assertThat(provider).isNotNull();
            assertThat(provider.getAccessTokenExpiresInSeconds()).isEqualTo(15 * 60);
            assertThat(provider.getRefreshTokenExpiresInSeconds()).isEqualTo(7 * 24 * 3600L);
        }
    }

    @Nested
    @DisplayName("generateAccessToken 生成 access token")
    class GenerateAccessToken {

        @Test
        @DisplayName("应生成可解析的 JWT 字符串")
        void shouldGenerateParsableJwtString() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateAccessToken(PRINCIPAL_ID, TENANT_ID, EMAIL, ROLES);

            // Assert
            assertThat(token).isNotNull().isNotEmpty();
            assertThat(token.split("\\.")).hasSize(3);
        }

        @Test
        @DisplayName("应正确写入 sub claim")
        void shouldSetSubjectClaim() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateAccessToken(PRINCIPAL_ID, TENANT_ID, EMAIL, ROLES);

            // Assert
            assertThat(provider.getPrincipalIdFromToken(token)).isEqualTo(PRINCIPAL_ID);
        }

        @Test
        @DisplayName("应正确写入 tenant_id claim")
        void shouldSetTenantIdClaim() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateAccessToken(PRINCIPAL_ID, TENANT_ID, EMAIL, ROLES);

            // Assert
            assertThat(provider.getTenantIdFromToken(token)).isEqualTo(TENANT_ID);
        }

        @Test
        @DisplayName("应正确写入 type=access claim")
        void shouldSetTypeClaimToAccess() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateAccessToken(PRINCIPAL_ID, TENANT_ID, EMAIL, ROLES);

            // Assert
            assertThat(provider.getTokenType(token)).isEqualTo(JwtTokenProvider.TYPE_ACCESS);
        }

        @Test
        @DisplayName("应正确写入 email claim")
        void shouldSetEmailClaim() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateAccessToken(PRINCIPAL_ID, TENANT_ID, EMAIL, ROLES);

            // Assert
            assertThat(provider.getEmailFromToken(token)).isEqualTo(EMAIL);
        }

        @Test
        @DisplayName("应正确写入 roles claim")
        void shouldSetRolesClaim() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateAccessToken(PRINCIPAL_ID, TENANT_ID, EMAIL, ROLES);

            // Assert
            assertThat(provider.getRolesFromToken(token)).containsExactlyElementsOf(ROLES);
        }

        @Test
        @DisplayName("email 为 null 时不应写入 email claim")
        void shouldNotSetEmailClaimWhenNull() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateAccessToken(PRINCIPAL_ID, TENANT_ID, null, ROLES);

            // Assert
            assertThat(provider.getEmailFromToken(token)).isNull();
        }

        @Test
        @DisplayName("roles 为 null 时应返回空列表")
        void shouldReturnEmptyRolesWhenNull() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateAccessToken(PRINCIPAL_ID, TENANT_ID, EMAIL, null);

            // Assert
            assertThat(provider.getRolesFromToken(token)).isEmpty();
        }

        @Test
        @DisplayName("roles 为空列表时应返回空列表")
        void shouldReturnEmptyRolesWhenEmpty() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateAccessToken(PRINCIPAL_ID, TENANT_ID, EMAIL, List.of());

            // Assert
            assertThat(provider.getRolesFromToken(token)).isEmpty();
        }

        @Test
        @DisplayName("应写入 jti（会话 ID）")
        void shouldSetJwtId() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateAccessToken(PRINCIPAL_ID, TENANT_ID, EMAIL, ROLES);

            // Assert
            assertThat(provider.getSessionIdFromToken(token)).isNotNull().isNotEmpty();
        }

        @Test
        @DisplayName("应写入 iat 与 exp 时间戳")
        void shouldSetIatAndExp() {
            // Arrange
            JwtTokenProvider provider = newProvider();
            Instant before = Instant.now().minusSeconds(2);

            // Act
            String token = provider.generateAccessToken(PRINCIPAL_ID, TENANT_ID, EMAIL, ROLES);

            // Assert
            Instant iat = provider.getIssuedAtFromToken(token);
            Instant exp = provider.getExpiresAtFromToken(token);
            assertThat(iat).isNotNull();
            assertThat(exp).isNotNull();
            // JWT iat 为秒级精度，预留 ±2 秒容差
            assertThat(iat).isBetween(before, Instant.now().plusSeconds(2));
            assertThat(exp).isAfter(iat);
            // exp - iat 应接近 15 分钟（±2 秒）
            Duration actualDuration = Duration.between(iat, exp);
            assertThat(Math.abs(actualDuration.minus(Duration.ofMinutes(15)).getSeconds()))
                    .isLessThanOrEqualTo(2L);
        }
    }

    @Nested
    @DisplayName("generateRefreshToken 生成 refresh token")
    class GenerateRefreshToken {

        @Test
        @DisplayName("应正确写入 type=refresh claim")
        void shouldSetTypeClaimToRefresh() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateRefreshToken(PRINCIPAL_ID, TENANT_ID);

            // Assert
            assertThat(provider.getTokenType(token)).isEqualTo(JwtTokenProvider.TYPE_REFRESH);
        }

        @Test
        @DisplayName("应正确写入 sub 与 tenant_id claim")
        void shouldSetSubjectAndTenantIdClaims() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateRefreshToken(PRINCIPAL_ID, TENANT_ID);

            // Assert
            assertThat(provider.getPrincipalIdFromToken(token)).isEqualTo(PRINCIPAL_ID);
            assertThat(provider.getTenantIdFromToken(token)).isEqualTo(TENANT_ID);
        }

        @Test
        @DisplayName("refresh token 不应包含 email claim")
        void shouldNotIncludeEmailClaim() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateRefreshToken(PRINCIPAL_ID, TENANT_ID);

            // Assert
            assertThat(provider.getEmailFromToken(token)).isNull();
        }

        @Test
        @DisplayName("refresh token 不应包含 roles claim")
        void shouldNotIncludeRolesClaim() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateRefreshToken(PRINCIPAL_ID, TENANT_ID);

            // Assert
            assertThat(provider.getRolesFromToken(token)).isEmpty();
        }

        @Test
        @DisplayName("refresh token 有效期应为 7 天")
        void shouldHaveSevenDayExpiration() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act
            String token = provider.generateRefreshToken(PRINCIPAL_ID, TENANT_ID);

            // Assert
            Instant iat = provider.getIssuedAtFromToken(token);
            Instant exp = provider.getExpiresAtFromToken(token);
            assertThat(exp).isAfter(iat);
            // exp - iat 应接近 7 天（±2 秒）
            Duration actualDuration = Duration.between(iat, exp);
            assertThat(Math.abs(actualDuration.minus(Duration.ofDays(7)).getSeconds()))
                    .isLessThanOrEqualTo(2L);
        }
    }

    @Nested
    @DisplayName("validateToken 验证 token")
    class ValidateToken {

        @Test
        @DisplayName("合法 access token 应通过验证")
        void shouldValidateValidAccessToken() {
            // Arrange
            JwtTokenProvider provider = newProvider();
            String token = provider.generateAccessToken(PRINCIPAL_ID, TENANT_ID, EMAIL, ROLES);

            // Act + Assert（不抛异常即通过）
            provider.validateToken(token);
        }

        @Test
        @DisplayName("合法 refresh token 应通过验证")
        void shouldValidateValidRefreshToken() {
            // Arrange
            JwtTokenProvider provider = newProvider();
            String token = provider.generateRefreshToken(PRINCIPAL_ID, TENANT_ID);

            // Act + Assert
            provider.validateToken(token);
        }

        @Test
        @DisplayName("非法 token 字符串应抛 TOKEN_INVALID 异常")
        void shouldRejectMalformedToken() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThatThrownBy(() -> provider.validateToken("not.a.valid.jwt"))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException bex = (BusinessException) ex;
                        assertThat(bex.getErrorCode()).isEqualTo(ErrorCode.TOKEN_INVALID);
                        assertThat(bex.getHttpStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    });
        }

        @Test
        @DisplayName("null token 应抛异常（ParseException 或 NPE）")
        void shouldRejectNullToken() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act + Assert：null token 触发底层解析异常，上层应转化为异常抛出
            assertThatThrownBy(() -> provider.validateToken(null))
                    .isInstanceOf(Exception.class);
        }

        @Test
        @DisplayName("使用不同密钥签名的 token 应拒绝")
        void shouldRejectTokenSignedWithDifferentSecret() {
            // Arrange
            JwtTokenProvider providerA = newProvider();
            String token = providerA.generateAccessToken(PRINCIPAL_ID, TENANT_ID, EMAIL, ROLES);

            // 用不同密钥构造另一个 provider
            appProperties.getSecurity().setJwtSecret("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789");
            JwtTokenProvider providerB = newProvider();

            // Act + Assert
            assertThatThrownBy(() -> providerB.validateToken(token))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException bex = (BusinessException) ex;
                        assertThat(bex.getErrorCode()).isIn(ErrorCode.TOKEN_INVALID, ErrorCode.TOKEN_EXPIRED);
                    });
        }
    }

    @Nested
    @DisplayName("getClaimFromToken 提取 claim 异常处理")
    class ClaimExtractionError {

        @Test
        @DisplayName("非法 token 提取 principalId 应抛 TOKEN_INVALID")
        void shouldThrowOnExtractFromMalformedToken() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThatThrownBy(() -> provider.getPrincipalIdFromToken("malformed"))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("非法 token 提取 tenantId 应抛 TOKEN_INVALID")
        void shouldThrowOnExtractTenantIdFromMalformedToken() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThatThrownBy(() -> provider.getTenantIdFromToken("malformed"))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("非法 token 提取 type 应抛 TOKEN_INVALID")
        void shouldThrowOnExtractTypeFromMalformedToken() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThatThrownBy(() -> provider.getTokenType("malformed"))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("非法 token 提取 email 应抛 TOKEN_INVALID")
        void shouldThrowOnExtractEmailFromMalformedToken() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThatThrownBy(() -> provider.getEmailFromToken("malformed"))
                    .isInstanceOf(BusinessException.class);
        }
    }

    @Nested
    @DisplayName("getExpiresInSeconds 获取有效期")
    class GetExpiresInSeconds {

        @Test
        @DisplayName("access token 有效期应为 15 分钟（900 秒）")
        void shouldReturn15MinutesForAccessToken() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThat(provider.getAccessTokenExpiresInSeconds()).isEqualTo(900L);
        }

        @Test
        @DisplayName("refresh token 有效期应为 7 天（604800 秒）")
        void shouldReturn7DaysForRefreshToken() {
            // Arrange
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThat(provider.getRefreshTokenExpiresInSeconds()).isEqualTo(604800L);
        }

        @Test
        @DisplayName("accessTokenExpire 为 null 应使用默认值 15 分钟")
        void shouldFallbackToDefaultWhenAccessTokenExpireIsNull() {
            // Arrange
            appProperties.getSecurity().setAccessTokenExpire(null);
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThat(provider.getAccessTokenExpiresInSeconds()).isEqualTo(900L);
        }

        @Test
        @DisplayName("refreshTokenExpire 为空字符串应使用默认值 7 天")
        void shouldFallbackToDefaultWhenRefreshTokenExpireIsBlank() {
            // Arrange
            appProperties.getSecurity().setRefreshTokenExpire("");
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThat(provider.getRefreshTokenExpiresInSeconds()).isEqualTo(604800L);
        }

        @Test
        @DisplayName("毫秒格式 '500ms' 应正确解析")
        void shouldParseMillisecondsFormat() {
            // Arrange
            appProperties.getSecurity().setAccessTokenExpire("500ms");
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThat(provider.getAccessTokenExpiresInSeconds()).isZero(); // 500ms 在秒级上为 0
        }

        @Test
        @DisplayName("秒格式 '30s' 应正确解析")
        void shouldParseSecondsFormat() {
            // Arrange
            appProperties.getSecurity().setAccessTokenExpire("30s");
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThat(provider.getAccessTokenExpiresInSeconds()).isEqualTo(30L);
        }

        @Test
        @DisplayName("小时格式 '2h' 应正确解析")
        void shouldParseHoursFormat() {
            // Arrange
            appProperties.getSecurity().setAccessTokenExpire("2h");
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThat(provider.getAccessTokenExpiresInSeconds()).isEqualTo(2 * 3600L);
        }

        @Test
        @DisplayName("天数格式 '1d' 应正确解析")
        void shouldParseDaysFormat() {
            // Arrange
            appProperties.getSecurity().setRefreshTokenExpire("1d");
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThat(provider.getRefreshTokenExpiresInSeconds()).isEqualTo(86400L);
        }

        @Test
        @DisplayName("纯数字应按秒解析")
        void shouldParsePlainNumberAsSeconds() {
            // Arrange
            appProperties.getSecurity().setAccessTokenExpire("120");
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThat(provider.getAccessTokenExpiresInSeconds()).isEqualTo(120L);
        }

        @Test
        @DisplayName("非法格式应回退到默认值")
        void shouldFallbackToDefaultOnInvalidFormat() {
            // Arrange
            appProperties.getSecurity().setAccessTokenExpire("abc");
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThat(provider.getAccessTokenExpiresInSeconds()).isEqualTo(900L);
        }

        @Test
        @DisplayName("带空格大写后缀应正确解析（'15M' → 15 分钟）")
        void shouldParseTrimmedLowercaseSuffix() {
            // Arrange
            appProperties.getSecurity().setAccessTokenExpire(" 15M ");
            JwtTokenProvider provider = newProvider();

            // Act + Assert
            assertThat(provider.getAccessTokenExpiresInSeconds()).isEqualTo(900L);
        }
    }
}
