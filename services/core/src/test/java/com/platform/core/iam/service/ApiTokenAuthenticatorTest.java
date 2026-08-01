package com.platform.core.iam.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.core.common.security.AuthenticatedPrincipal;
import com.platform.core.iam.domain.ApiToken;
import com.platform.core.iam.repository.ApiTokenRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * ApiTokenAuthenticator 单元测试（P0-16.1 Token 认证中间件）
 *
 * <p>覆盖：
 * <ul>
 *   <li>PAT 格式校验：null / 空串 / 长度不足 / 长度超长 / 含非十六进制字符 / 含点分隔符（JWT 干扰）</li>
 *   <li>认证：prefix 未匹配候选 Token / 哈希比对不匹配 / 哈希匹配但已过期</li>
 *   <li>认证成功：构建 AuthenticatedPrincipal + 更新 lastUsedAt</li>
 *   <li>lastUsedAt 更新失败不阻断认证</li>
 *   <li>多候选 Token 逐一比对：第一个不匹配，第二个匹配</li>
 * </ul>
 *
 * <p>权威源：ApiTokenAuthenticator.java + security.md §1 密钥管理 + §2.2 认证 Token
 */
@DisplayName("ApiTokenAuthenticator PAT 认证")
@ExtendWith(MockitoExtension.class)
class ApiTokenAuthenticatorTest {

    @Mock
    private ApiTokenRepository repository;

    private ApiTokenAuthenticator authenticator;

    private static final String PLAIN_TOKEN =
            "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
    private static final String PREFIX = PLAIN_TOKEN.substring(0, 12);
    private static final String SALT = "00112233445566778899001122334455";

    private final UUID principalId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @BeforeEach
    void setUp() {
        authenticator = new ApiTokenAuthenticator(repository);
    }

    @AfterEach
    void tearDown() {
        // 无 SecurityContext 残留需要清理（Authenticator 本身不直接操作 SecurityContext）
    }

    // ===== isValidPatFormat 格式校验 =====

    @Test
    @DisplayName("isValidPatFormat null 应返回 false")
    void isValidPatFormat_shouldReturnFalseWhenNull() {
        assertThat(authenticator.isValidPatFormat(null)).isFalse();
    }

    @Test
    @DisplayName("isValidPatFormat 空串应返回 false")
    void isValidPatFormat_shouldReturnFalseWhenEmpty() {
        assertThat(authenticator.isValidPatFormat("")).isFalse();
    }

    @Test
    @DisplayName("isValidPatFormat 长度不足 64 应返回 false")
    void isValidPatFormat_shouldReturnFalseWhenLengthTooShort() {
        assertThat(authenticator.isValidPatFormat("a1b2c3d4e5f6")).isFalse();
    }

    @Test
    @DisplayName("isValidPatFormat 长度超过 64 应返回 false")
    void isValidPatFormat_shouldReturnFalseWhenLengthTooLong() {
        String tooLong = PLAIN_TOKEN + "ab";
        assertThat(authenticator.isValidPatFormat(tooLong)).isFalse();
    }

    @Test
    @DisplayName("isValidPatFormat 含非十六进制字符应返回 false")
    void isValidPatFormat_shouldReturnFalseWhenContainsNonHexChars() {
        // 含 g/h/i/j 等非十六进制字符
        String invalid = "g1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
        assertThat(authenticator.isValidPatFormat(invalid)).isFalse();
    }

    @Test
    @DisplayName("isValidPatFormat 含点分隔符（JWT 干扰）应返回 false")
    void isValidPatFormat_shouldReturnFalseWhenContainsDotSeparator() {
        // JWT 格式 xxx.yyy.zzz，PAT 不识别让 JWT Filter 处理
        String jwt = "eyJhbGci.eyJzdWIi.SflKxwRJSM";
        assertThat(authenticator.isValidPatFormat(jwt)).isFalse();
    }

    @Test
    @DisplayName("isValidPatFormat 64 位小写十六进制应返回 true")
    void isValidPatFormat_shouldReturnTrueWhenValidLowerHex() {
        assertThat(authenticator.isValidPatFormat(PLAIN_TOKEN)).isTrue();
    }

    @Test
    @DisplayName("isValidPatFormat 64 位大写十六进制应返回 true")
    void isValidPatFormat_shouldReturnTrueWhenValidUpperHex() {
        String upper = PLAIN_TOKEN.toUpperCase();
        assertThat(authenticator.isValidPatFormat(upper)).isTrue();
    }

    // ===== authenticate 认证流程 =====

    @Test
    @DisplayName("authenticate 格式无效（null）应返回 empty 且不查库")
    void authenticate_shouldReturnEmptyWhenFormatInvalid() {
        // Act
        Optional<AuthenticatedPrincipal> result = authenticator.authenticate(null);

        // Assert
        assertThat(result).isEmpty();
        verify(repository, never()).findByPrefixAndStatus(any(), any());
    }

    @Test
    @DisplayName("authenticate prefix 未匹配候选 Token 应返回 empty")
    void authenticate_shouldReturnEmptyWhenNoCandidateFound() {
        // Arrange
        when(repository.findByPrefixAndStatus(PREFIX, "active")).thenReturn(List.of());

        // Act
        Optional<AuthenticatedPrincipal> result = authenticator.authenticate(PLAIN_TOKEN);

        // Assert
        assertThat(result).isEmpty();
        verify(repository).findByPrefixAndStatus(PREFIX, "active");
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("authenticate 哈希比对不匹配应返回 empty 不更新 lastUsedAt")
    void authenticate_shouldReturnEmptyWhenHashMismatch() {
        // Arrange
        ApiToken candidate = buildCandidate("wrong_hash", SALT, Instant.now().plus(Duration.ofDays(30)));
        when(repository.findByPrefixAndStatus(PREFIX, "active"))
                .thenReturn(List.of(candidate));

        // Act
        Optional<AuthenticatedPrincipal> result = authenticator.authenticate(PLAIN_TOKEN);

        // Assert
        assertThat(result).isEmpty();
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("authenticate 哈希匹配但已过期应返回 empty 不更新 lastUsedAt")
    void authenticate_shouldReturnEmptyWhenTokenExpired() {
        // Arrange
        String expectedHash = computeHash(PLAIN_TOKEN, SALT);
        ApiToken candidate = buildCandidate(expectedHash, SALT, Instant.now().minus(Duration.ofDays(1)));
        when(repository.findByPrefixAndStatus(PREFIX, "active"))
                .thenReturn(List.of(candidate));

        // Act
        Optional<AuthenticatedPrincipal> result = authenticator.authenticate(PLAIN_TOKEN);

        // Assert
        assertThat(result).isEmpty();
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("authenticate 哈希匹配且未过期应返回 Principal 并更新 lastUsedAt")
    void authenticate_shouldReturnPrincipalWhenHashMatchedAndNotExpired() {
        // Arrange
        String expectedHash = computeHash(PLAIN_TOKEN, SALT);
        ApiToken candidate = buildCandidate(expectedHash, SALT, Instant.now().plus(Duration.ofDays(30)));
        when(repository.findByPrefixAndStatus(PREFIX, "active"))
                .thenReturn(List.of(candidate));
        when(repository.save(any(ApiToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        Optional<AuthenticatedPrincipal> result = authenticator.authenticate(PLAIN_TOKEN);

        // Assert
        assertThat(result).isPresent();
        AuthenticatedPrincipal principal = result.get();
        assertThat(principal.principalId()).isEqualTo(principalId);
        assertThat(principal.tenantId()).isEqualTo(tenantId);
        // V0 限制：email=null / roles=空 / sessionId="pat:" + tokenId
        assertThat(principal.email()).isNull();
        assertThat(principal.roles()).isEmpty();
        assertThat(principal.sessionId()).isEqualTo("pat:" + candidate.getId());

        // 验证 lastUsedAt 被更新
        ArgumentCaptor<ApiToken> captor = ArgumentCaptor.forClass(ApiToken.class);
        verify(repository).save(captor.capture());
        ApiToken saved = captor.getValue();
        assertThat(saved.getLastUsedAt()).isNotNull();
    }

    @Test
    @DisplayName("authenticate 多候选 Token 第一个不匹配，第二个匹配应返回 Principal")
    void authenticate_shouldReturnPrincipalWhenSecondCandidateMatches() {
        // Arrange：第一个候选哈希不匹配，第二个候选哈希匹配
        String correctHash = computeHash(PLAIN_TOKEN, SALT);
        ApiToken wrongCandidate = buildCandidate("wrong_hash", SALT, Instant.now().plus(Duration.ofDays(30)));
        ApiToken correctCandidate = buildCandidate(correctHash, SALT, Instant.now().plus(Duration.ofDays(30)));
        // 给两个候选不同 ID
        correctCandidate.setId(UUID.fromString("77777777-7777-7777-7777-777777777777"));

        when(repository.findByPrefixAndStatus(PREFIX, "active"))
                .thenReturn(List.of(wrongCandidate, correctCandidate));
        when(repository.save(any(ApiToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        Optional<AuthenticatedPrincipal> result = authenticator.authenticate(PLAIN_TOKEN);

        // Assert
        assertThat(result).isPresent();
        assertThat(result.get().sessionId()).isEqualTo("pat:" + correctCandidate.getId());
    }

    @Test
    @DisplayName("authenticate lastUsedAt 更新失败不阻断认证")
    void authenticate_shouldStillReturnPrincipalWhenLastUsedAtUpdateFails() {
        // Arrange
        String expectedHash = computeHash(PLAIN_TOKEN, SALT);
        ApiToken candidate = buildCandidate(expectedHash, SALT, Instant.now().plus(Duration.ofDays(30)));
        when(repository.findByPrefixAndStatus(PREFIX, "active"))
                .thenReturn(List.of(candidate));
        // save 抛异常模拟更新失败
        when(repository.save(any(ApiToken.class)))
                .thenThrow(new RuntimeException("DB connection lost"));

        // Act
        Optional<AuthenticatedPrincipal> result = authenticator.authenticate(PLAIN_TOKEN);

        // Assert：认证仍然成功，仅记录日志
        assertThat(result).isPresent();
        assertThat(result.get().principalId()).isEqualTo(principalId);
    }

    // ===== 辅助方法 =====

    /**
     * 构建候选 Token 实体
     *
     * @param tokenHash 哈希值（决定是否匹配）
     * @param salt      盐值（与哈希比对时使用）
     * @param expiresAt 过期时间（决定是否过期）
     */
    private ApiToken buildCandidate(String tokenHash, String salt, Instant expiresAt) {
        ApiToken token = new ApiToken();
        token.setId(UUID.fromString("66666666-6666-6666-6666-666666666666"));
        token.setPrincipalId(principalId);
        token.setTenantId(tenantId);
        token.setName("CI/CD Pipeline");
        token.setPrefix(PREFIX);
        token.setTokenHash(tokenHash);
        token.setTokenSalt(salt);
        token.setScopes("[\"read:projects\"]");
        token.setStatus("active");
        token.setExpiresAt(expiresAt);
        token.setCreatedAt(Instant.now().minus(Duration.ofDays(1)));
        token.setUpdatedAt(Instant.now().minus(Duration.ofDays(1)));
        token.setRowVersion(1L);
        return token;
    }

    /**
     * 复制 ApiTokenService.hashToken 算法，构造预期哈希
     * SHA-256(salt + ":" + token) → 64 位十六进制字符串
     */
    private static String computeHash(String token, String salt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest((salt + ":" + token).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
