package com.platform.core.auth.service;

import com.platform.core.auth.dto.ChangePasswordRequest;
import com.platform.core.auth.dto.LoginRequest;
import com.platform.core.auth.dto.LogoutRequest;
import com.platform.core.auth.dto.LogoutResponse;
import com.platform.core.auth.dto.RefreshTokenResponse;
import com.platform.core.auth.jwt.JwtTokenProvider;
import com.platform.core.auth.security.AuthenticatedPrincipal;
import com.platform.core.auth.token.RefreshTokenStore;
import com.platform.core.common.config.AppProperties;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.domain.Principal;
import com.platform.core.iam.domain.Tenant;
import com.platform.core.iam.repository.AccessGrantRepository;
import com.platform.core.iam.repository.PrincipalRepository;
import com.platform.core.iam.repository.RoleBindingRepository;
import com.platform.core.iam.repository.TenantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Collection;
import java.util.Collections;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    /** 测试用 HS256 密钥（≥32 字节） */
    private static final String TEST_JWT_SECRET =
            "test-secret-key-for-unit-test-at-least-32-bytes-long!";

    @Mock
    private PrincipalRepository principalRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private RoleBindingRepository roleBindingRepository;

    @Mock
    private AccessGrantRepository accessGrantRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private RefreshTokenStore refreshTokenStore;

    private AuthService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID principalId = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @BeforeEach
    void setUp() {
        // 构造真实 AppProperties，初始化 JwtTokenProvider
        AppProperties appProperties = new AppProperties();
        appProperties.setSecurity(new AppProperties.Security());
        appProperties.getSecurity().setJwtSecret(TEST_JWT_SECRET);
        appProperties.getSecurity().setAccessTokenExpire("15m");
        appProperties.getSecurity().setRefreshTokenExpire("7d");

        jwtTokenProvider = new JwtTokenProvider(appProperties);
        // init() 为包私有方法，通过反射调用以完成签名器初始化
        ReflectionTestUtils.invokeMethod(jwtTokenProvider, "init");

        service = new AuthService(
                principalRepository, tenantRepository, roleBindingRepository,
                accessGrantRepository, passwordEncoder, jwtTokenProvider, refreshTokenStore);
        SecurityContextHolder.clearContext();
    }

    /**
     * 手动构造 SecurityContext，绕过 Java 25 下 Mockito 无法 mock Authentication 的问题
     */
    private void setupAuthenticatedPrincipal(UUID pid, UUID tid) {
        AuthenticatedPrincipal auth = new AuthenticatedPrincipal(
                pid, tid, "test@example.com", Collections.emptyList(), "session-123",
                Instant.now(), Instant.now().plusSeconds(3600));
        // 使用匿名内部类替代 Mockito mock
        Authentication authentication = new Authentication() {
            @Override public String getName() { return auth.principalId().toString(); }
            @Override public Collection<? extends org.springframework.security.core.GrantedAuthority> getAuthorities() {
                return Collections.emptyList();
            }
            @Override public Object getCredentials() { return null; }
            @Override public Object getDetails() { return null; }
            @Override public Object getPrincipal() { return auth; }
            @Override public boolean isAuthenticated() { return true; }
            @Override public void setAuthenticated(boolean isAuthenticated) { /* 不需要 */ }
        };
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
    }

    @Nested
    @DisplayName("登录")
    class Login {

        @Test
        @DisplayName("应该成功登录并返回 token")
        void shouldLoginSuccessfully() {
            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setTenantId(tenantId);
            principal.setEmail("test@example.com");
            principal.setDisplayName("Test User");
            principal.setPasswordHash("encoded-password");
            principal.setStatus("ACTIVE");
            principal.setType("USER");
            principal.setLocale("en");
            principal.setTimezone("UTC");

            Tenant tenant = new Tenant();
            tenant.setId(tenantId);
            tenant.setName("Test Tenant");
            tenant.setCode("TENANT-001");

            when(principalRepository.findByTenantIdAndEmailAndDeletedAtIsNull(tenantId, "test@example.com"))
                    .thenReturn(Optional.of(principal));
            when(passwordEncoder.matches("password123", "encoded-password")).thenReturn(true);
            when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));

            LoginRequest request = new LoginRequest("test@example.com", "password123", false);

            AuthService.LoginResult result = service.login(tenantId, request);

            assertThat(result.response()).isNotNull();
            // 真实 JwtTokenProvider 生成的 token 可被解析验证
            assertThat(jwtTokenProvider.getTokenType(result.response().accessToken()))
                    .isEqualTo(JwtTokenProvider.TYPE_ACCESS);
            assertThat(jwtTokenProvider.getPrincipalIdFromToken(result.response().accessToken()))
                    .isEqualTo(principalId);
            assertThat(jwtTokenProvider.getTokenType(result.refreshToken()))
                    .isEqualTo(JwtTokenProvider.TYPE_REFRESH);
        }

        @Test
        @DisplayName("应该在邮箱不存在时返回统一错误消息")
        void shouldReturnUnifiedErrorWhenEmailNotFound() {
            when(principalRepository.findByTenantIdAndEmailAndDeletedAtIsNull(tenantId, "notexist@example.com"))
                    .thenReturn(Optional.empty());

            LoginRequest request = new LoginRequest("notexist@example.com", "password123", false);

            assertThatThrownBy(() -> service.login(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BAD_CREDENTIALS);
        }

        @Test
        @DisplayName("应该在密码错误时返回统一错误消息")
        void shouldReturnUnifiedErrorWhenPasswordIncorrect() {
            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setPasswordHash("encoded-password");
            principal.setStatus("ACTIVE");

            when(principalRepository.findByTenantIdAndEmailAndDeletedAtIsNull(tenantId, "test@example.com"))
                    .thenReturn(Optional.of(principal));
            when(passwordEncoder.matches("wrong-password", "encoded-password")).thenReturn(false);

            LoginRequest request = new LoginRequest("test@example.com", "wrong-password", false);

            assertThatThrownBy(() -> service.login(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BAD_CREDENTIALS);
        }

        @Test
        @DisplayName("应该在主体状态非 ACTIVE 时返回统一错误消息")
        void shouldReturnUnifiedErrorWhenPrincipalNotActive() {
            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setPasswordHash("encoded-password");
            principal.setStatus("INACTIVE");

            when(principalRepository.findByTenantIdAndEmailAndDeletedAtIsNull(tenantId, "test@example.com"))
                    .thenReturn(Optional.of(principal));
            when(passwordEncoder.matches("password123", "encoded-password")).thenReturn(true);

            LoginRequest request = new LoginRequest("test@example.com", "password123", false);

            assertThatThrownBy(() -> service.login(tenantId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BAD_CREDENTIALS);
        }
    }

    @Nested
    @DisplayName("刷新 Token")
    class RefreshToken {

        @Test
        @DisplayName("应该成功刷新 access token")
        void shouldRefreshTokenSuccessfully() {
            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setTenantId(tenantId);
            principal.setEmail("test@example.com");
            principal.setStatus("ACTIVE");

            // 用真实 JwtTokenProvider 生成 refresh token
            String validRefreshToken = jwtTokenProvider.generateRefreshToken(principalId, tenantId);

            when(refreshTokenStore.validate(validRefreshToken)).thenReturn(true);
            when(principalRepository.findById(principalId)).thenReturn(Optional.of(principal));

            RefreshTokenResponse result = service.refreshToken(validRefreshToken);

            // 真实 JwtTokenProvider 生成的 access token 可被解析
            assertThat(jwtTokenProvider.getTokenType(result.accessToken()))
                    .isEqualTo(JwtTokenProvider.TYPE_ACCESS);
            assertThat(jwtTokenProvider.getPrincipalIdFromToken(result.accessToken()))
                    .isEqualTo(principalId);
            assertThat(result.accessTokenExpiresIn()).isEqualTo(900L);
            assertThat(result.refreshTokenSet()).isTrue();
        }

        @Test
        @DisplayName("应该在 refresh token 缺失时抛出异常")
        void shouldThrowWhenRefreshTokenBlank() {
            assertThatThrownBy(() -> service.refreshToken(""))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.REFRESH_TOKEN_INVALID);
        }

        @Test
        @DisplayName("应该在 refresh token 已撤销时抛出异常")
        void shouldThrowWhenRefreshTokenRevoked() {
            String validRefreshToken = jwtTokenProvider.generateRefreshToken(principalId, tenantId);
            when(refreshTokenStore.validate(validRefreshToken)).thenReturn(false);

            assertThatThrownBy(() -> service.refreshToken(validRefreshToken))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.REFRESH_TOKEN_INVALID);
        }

        @Test
        @DisplayName("应该在主体状态非 ACTIVE 时抛出异常")
        void shouldThrowWhenPrincipalNotActive() {
            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setStatus("INACTIVE");

            String validRefreshToken = jwtTokenProvider.generateRefreshToken(principalId, tenantId);
            when(refreshTokenStore.validate(validRefreshToken)).thenReturn(true);
            when(principalRepository.findById(principalId)).thenReturn(Optional.of(principal));

            assertThatThrownBy(() -> service.refreshToken(validRefreshToken))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.UNAUTHORIZED);
        }
    }

    @Nested
    @DisplayName("修改密码")
    class ChangePassword {

        @Test
        @DisplayName("应该成功修改密码")
        void shouldChangePasswordSuccessfully() {
            setupAuthenticatedPrincipal(principalId, tenantId);

            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setPasswordHash("old-encoded-password");

            when(principalRepository.findById(principalId)).thenReturn(Optional.of(principal));
            when(passwordEncoder.matches("old-password", "old-encoded-password")).thenReturn(true);
            when(passwordEncoder.encode("NewPass123")).thenReturn("new-encoded-password");

            ChangePasswordRequest request = new ChangePasswordRequest("old-password", "NewPass123");

            service.changePassword(request);

            verify(principalRepository).save(principal);
            assertThat(principal.getPasswordHash()).isEqualTo("new-encoded-password");
        }

        @Test
        @DisplayName("应该在当前密码错误时抛出异常")
        void shouldThrowWhenCurrentPasswordIncorrect() {
            setupAuthenticatedPrincipal(principalId, tenantId);

            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setPasswordHash("old-encoded-password");

            when(principalRepository.findById(principalId)).thenReturn(Optional.of(principal));
            when(passwordEncoder.matches("wrong-password", "old-encoded-password")).thenReturn(false);

            ChangePasswordRequest request = new ChangePasswordRequest("wrong-password", "NewPass123");

            assertThatThrownBy(() -> service.changePassword(request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BAD_CREDENTIALS);
        }

        @Test
        @DisplayName("应该在新密码不符合策略时抛出异常")
        void shouldThrowWhenNewPasswordNotMeetPolicy() {
            setupAuthenticatedPrincipal(principalId, tenantId);

            Principal principal = new Principal();
            principal.setId(principalId);
            principal.setPasswordHash("old-encoded-password");

            when(principalRepository.findById(principalId)).thenReturn(Optional.of(principal));
            when(passwordEncoder.matches("old-password", "old-encoded-password")).thenReturn(true);

            ChangePasswordRequest request = new ChangePasswordRequest("old-password", "short1");

            assertThatThrownBy(() -> service.changePassword(request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PASSWORD_POLICY_VIOLATION);
        }

        @Test
        @DisplayName("应该在未登录时抛出异常")
        void shouldThrowWhenNotLoggedIn() {
            ChangePasswordRequest request = new ChangePasswordRequest("old-password", "NewPass123");

            assertThatThrownBy(() -> service.changePassword(request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.UNAUTHORIZED);
        }
    }

    @Nested
    @DisplayName("登出")
    class Logout {

        @Test
        @DisplayName("应该成功登出单设备")
        void shouldLogoutSingleDevice() {
            LogoutResponse result = service.logout(null, "refresh-token");

            assertThat(result.revoked()).isTrue();
            verify(refreshTokenStore).revoke("refresh-token");
        }

        @Test
        @DisplayName("应该成功登出所有设备")
        void shouldLogoutAllDevices() {
            setupAuthenticatedPrincipal(principalId, tenantId);

            LogoutRequest request = new LogoutRequest(true);
            LogoutResponse result = service.logout(request, "refresh-token");

            assertThat(result.revoked()).isTrue();
            verify(refreshTokenStore).revokeAllForPrincipal(principalId);
        }

        @Test
        @DisplayName("应该在未携带 refresh token 时返回成功")
        void shouldReturnSuccessWithoutRefreshToken() {
            LogoutResponse result = service.logout(null, null);

            assertThat(result.revoked()).isTrue();
        }
    }
}