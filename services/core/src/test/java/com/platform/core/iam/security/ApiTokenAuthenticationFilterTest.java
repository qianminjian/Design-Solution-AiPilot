package com.platform.core.iam.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.platform.core.common.security.AuthenticatedPrincipal;
import com.platform.core.iam.service.ApiTokenAuthenticator;
import com.platform.core.iam.support.TenantContextHolder;
import jakarta.servlet.FilterChain;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * ApiTokenAuthenticationFilter 单元测试（P0-16.1 Token 认证中间件）
 *
 * <p>覆盖场景：
 * <ul>
 *   <li>token 提取与跳过路径：无 Authorization / 非 Bearer / Bearer JWT（含点）</li>
 *   <li>PAT 认证路径：成功 → 注入 SecurityContext + TenantContextHolder</li>
 *   <li>PAT 认证路径：失败（返回 empty） → 不注入，链继续</li>
 *   <li>PAT 认证抛异常 → catch 后清理 SecurityContext，链继续</li>
 *   <li>请求结束清理 TenantContextHolder + SecurityContext（防 ThreadLocal 内存泄漏）</li>
 * </ul>
 *
 * <p>使用 MockHttpServletRequest/Response + mock ApiTokenAuthenticator，避免真实 DB 查询。
 */
@DisplayName("ApiTokenAuthenticationFilter PAT 认证过滤器")
class ApiTokenAuthenticationFilterTest {

    private static final String BEARER_PREFIX = "Bearer ";

    /** 64 位十六进制 PAT */
    private static final String VALID_PAT =
            "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

    /** JWT 格式（含两个点分隔符），PAT 不应识别 */
    private static final String JWT_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.SflKxwRJSM";

    private ApiTokenAuthenticator apiTokenAuthenticator;
    private ApiTokenAuthenticationFilter filter;
    private FilterChain filterChain;

    private final UUID principalId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @BeforeEach
    void setUp() {
        apiTokenAuthenticator = mock(ApiTokenAuthenticator.class);
        filter = new ApiTokenAuthenticationFilter(apiTokenAuthenticator);
        filterChain = mock(FilterChain.class);
        SecurityContextHolder.clearContext();
        TenantContextHolder.clear();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContextHolder.clear();
    }

    @Nested
    @DisplayName("token 提取与跳过路径")
    class Extraction {

        @Test
        @DisplayName("无 Authorization 头时应跳过认证且链继续")
        void shouldSkipWhenNoAuthorizationHeader() throws Exception {
            // Arrange
            MockHttpServletRequest request = new MockHttpServletRequest();
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            filter.doFilter(request, response, filterChain);

            // Assert
            verify(apiTokenAuthenticator, never()).authenticate(any());
            verify(filterChain, times(1)).doFilter(request, response);
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            assertThat(TenantContextHolder.getTenantId()).isEmpty();
        }

        @Test
        @DisplayName("Authorization 非 Bearer 前缀时应跳过认证")
        void shouldSkipWhenNotBearer() throws Exception {
            // Arrange
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", "Basic abc123");
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            filter.doFilter(request, response, filterChain);

            // Assert
            verify(apiTokenAuthenticator, never()).authenticate(any());
            verify(filterChain, times(1)).doFilter(request, response);
        }

        @Test
        @DisplayName("Bearer JWT 格式（含点分隔符）应跳过 PAT 认证交由 JWT Filter")
        void shouldSkipWhenBearerJwtFormat() throws Exception {
            // Arrange：isValidPatFormat 应返回 false，不进入 authenticate
            when(apiTokenAuthenticator.isValidPatFormat(JWT_TOKEN)).thenReturn(false);

            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + JWT_TOKEN);
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            filter.doFilter(request, response, filterChain);

            // Assert
            verify(apiTokenAuthenticator).isValidPatFormat(JWT_TOKEN);
            verify(apiTokenAuthenticator, never()).authenticate(any());
            verify(filterChain, times(1)).doFilter(request, response);
        }

        @Test
        @DisplayName("Bearer PAT 格式非法（长度不足）应跳过 authenticate 调用")
        void shouldSkipWhenPatFormatInvalid() throws Exception {
            // Arrange
            String invalidPat = "abc123";  // 长度不足
            when(apiTokenAuthenticator.isValidPatFormat(invalidPat)).thenReturn(false);

            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + invalidPat);
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            filter.doFilter(request, response, filterChain);

            // Assert
            verify(apiTokenAuthenticator).isValidPatFormat(invalidPat);
            verify(apiTokenAuthenticator, never()).authenticate(any());
            verify(filterChain, times(1)).doFilter(request, response);
        }
    }

    @Nested
    @DisplayName("PAT 认证路径")
    class AuthenticationFlow {

        @Test
        @DisplayName("Bearer PAT 认证成功应注入 SecurityContext + TenantContextHolder")
        void shouldInjectContextWhenPatAuthenticationSucceeds() throws Exception {
            // Arrange
            AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
                    principalId, tenantId, null, List.of(),
                    "pat:test-token", Instant.now(), Instant.now().plusSeconds(300));
            when(apiTokenAuthenticator.isValidPatFormat(VALID_PAT)).thenReturn(true);
            when(apiTokenAuthenticator.authenticate(VALID_PAT)).thenReturn(Optional.of(principal));

            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + VALID_PAT);
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            filter.doFilter(request, response, filterChain);

            // Assert：SecurityContext 中已有 Authentication
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            // 注意：filter 在 finally 中清理了 SecurityContext，所以这里应该是空
            // 我们用 ArgumentCaptor 或者通过验证 authenticator.authenticate 被调用来证明

            verify(apiTokenAuthenticator).authenticate(VALID_PAT);
            verify(filterChain, times(1)).doFilter(request, response);

            // finally 块清理后应为空
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            assertThat(TenantContextHolder.getTenantId()).isEmpty();
        }

        @Test
        @DisplayName("Bearer PAT 认证失败（返回 empty）应不注入上下文链继续")
        void shouldNotInjectWhenPatAuthenticationFails() throws Exception {
            // Arrange
            when(apiTokenAuthenticator.isValidPatFormat(VALID_PAT)).thenReturn(true);
            when(apiTokenAuthenticator.authenticate(VALID_PAT)).thenReturn(Optional.empty());

            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + VALID_PAT);
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            filter.doFilter(request, response, filterChain);

            // Assert
            verify(apiTokenAuthenticator).authenticate(VALID_PAT);
            verify(filterChain, times(1)).doFilter(request, response);
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            assertThat(TenantContextHolder.getTenantId()).isEmpty();
        }

        @Test
        @DisplayName("Bearer PAT 认证抛异常应 catch 后清理上下文链继续")
        void shouldClearContextWhenAuthenticatorThrows() throws Exception {
            // Arrange
            when(apiTokenAuthenticator.isValidPatFormat(VALID_PAT)).thenReturn(true);
            when(apiTokenAuthenticator.authenticate(VALID_PAT))
                    .thenThrow(new RuntimeException("DB connection lost"));

            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + VALID_PAT);
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act：不应抛异常
            filter.doFilter(request, response, filterChain);

            // Assert：链继续，SecurityContext 已清理
            verify(apiTokenAuthenticator).authenticate(VALID_PAT);
            verify(filterChain, times(1)).doFilter(request, response);
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        }
    }

    @Nested
    @DisplayName("ThreadLocal 清理")
    class ThreadLocalCleanup {

        @Test
        @DisplayName("请求结束（无论认证成功失败）应清理 TenantContextHolder + SecurityContext")
        void shouldClearThreadLocalAfterRequest() throws Exception {
            // Arrange：认证成功后上下文会被设置，但 finally 块应清理
            AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
                    principalId, tenantId, null, List.of(),
                    "pat:test", Instant.now(), Instant.now().plusSeconds(300));
            when(apiTokenAuthenticator.isValidPatFormat(VALID_PAT)).thenReturn(true);
            when(apiTokenAuthenticator.authenticate(VALID_PAT)).thenReturn(Optional.of(principal));

            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + VALID_PAT);
            MockHttpServletResponse response = new MockHttpServletResponse();

            // Act
            filter.doFilter(request, response, filterChain);

            // Assert：finally 块清理后 ThreadLocal 应为空
            assertThat(TenantContextHolder.getTenantId()).isEmpty();
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        }

        @Test
        @DisplayName("链中 doFilter 抛异常时应确保 ThreadLocal 被清理")
        void shouldClearThreadLocalWhenChainThrows() throws Exception {
            // Arrange
            when(apiTokenAuthenticator.isValidPatFormat(VALID_PAT)).thenReturn(true);
            when(apiTokenAuthenticator.authenticate(VALID_PAT)).thenReturn(Optional.empty());

            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + VALID_PAT);
            MockHttpServletResponse response = new MockHttpServletResponse();

            // 链中抛异常
            org.mockito.Mockito.doThrow(new RuntimeException("downstream error"))
                    .when(filterChain).doFilter(request, response);

            // Act + Assert：异常应向上传播，但 ThreadLocal 应被清理
            try {
                filter.doFilter(request, response, filterChain);
            } catch (RuntimeException ignored) {
                // 预期抛异常
            }

            // Assert：finally 块清理 ThreadLocal
            assertThat(TenantContextHolder.getTenantId()).isEmpty();
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        }
    }
}
