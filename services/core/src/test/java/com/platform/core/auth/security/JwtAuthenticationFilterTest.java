package com.platform.core.auth.security;

import com.platform.core.auth.jwt.JwtTokenProvider;
import com.platform.core.common.security.AuthenticatedPrincipal;
import com.platform.core.iam.support.TenantContextHolder;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * JwtAuthenticationFilter 单元测试
 *
 * <p>覆盖场景：
 * <ul>
 *   <li>无 Authorization 头：跳过认证</li>
 *   <li>Authorization 非 Bearer 前缀：跳过认证</li>
 *   <li>token 验证失败：清理 SecurityContext，链继续</li>
 *   <li>token 类型非 access：清理 SecurityContext，链继续</li>
 *   <li>合法 access token：设置 Authentication + TenantContextHolder，链继续</li>
 *   <li>请求结束清理 TenantContextHolder 与 SecurityContext</li>
 * </ul>
 *
 * <p>使用 MockHttpServletRequest/Response + mock JwtTokenProvider，避免真实 JWT 签名。
 */
@DisplayName("JwtAuthenticationFilter JWT 认证过滤器")
class JwtAuthenticationFilterTest {

    private static final String VALID_TOKEN = "valid.jwt.token";
    private static final String BEARER_PREFIX = "Bearer ";

    private JwtTokenProvider jwtTokenProvider;
    private JwtAuthenticationFilter filter;
    private FilterChain filterChain;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = mock(JwtTokenProvider.class);
        filter = new JwtAuthenticationFilter(jwtTokenProvider);
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
            verify(jwtTokenProvider, never()).validateToken(any());
            verify(filterChain, times(1)).doFilter(request, response);
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
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
            verify(jwtTokenProvider, never()).validateToken(any());
            verify(filterChain, times(1)).doFilter(request, response);
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        }

        @Test
        @DisplayName("Authorization 头仅 Bearer 前缀时应清理上下文（空 token 视为非法）")
        void shouldClearContextWhenBearerEmpty() throws Exception {
            // Arrange
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + "  ");
            MockHttpServletResponse response = new MockHttpServletResponse();
            org.mockito.Mockito.doThrow(new RuntimeException("empty token"))
                    .when(jwtTokenProvider).validateToken("");

            // Act
            filter.doFilter(request, response, filterChain);

            // Assert
            verify(jwtTokenProvider, times(1)).validateToken("");
            verify(filterChain, times(1)).doFilter(request, response);
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        }
    }

    @Nested
    @DisplayName("token 验证失败路径")
    class ValidationFailure {

        @Test
        @DisplayName("token 验证失败时应清理上下文且链继续")
        void shouldClearContextWhenValidationFails() throws Exception {
            // Arrange
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + "invalid.token");
            MockHttpServletResponse response = new MockHttpServletResponse();
            org.mockito.Mockito.doThrow(new RuntimeException("token expired"))
                    .when(jwtTokenProvider).validateToken("invalid.token");

            // Act
            filter.doFilter(request, response, filterChain);

            // Assert
            verify(jwtTokenProvider, times(1)).validateToken("invalid.token");
            verify(filterChain, times(1)).doFilter(request, response);
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        }

        @Test
        @DisplayName("token 类型非 access 时应清理上下文")
        void shouldClearContextWhenTokenTypeIsRefresh() throws Exception {
            // Arrange
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + VALID_TOKEN);
            MockHttpServletResponse response = new MockHttpServletResponse();
            when(jwtTokenProvider.getTokenType(VALID_TOKEN))
                    .thenReturn(JwtTokenProvider.TYPE_REFRESH);

            // Act
            filter.doFilter(request, response, filterChain);

            // Assert
            verify(jwtTokenProvider, times(1)).validateToken(VALID_TOKEN);
            verify(jwtTokenProvider, never()).getPrincipalIdFromToken(any());
            verify(filterChain, times(1)).doFilter(request, response);
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        }
    }

    @Nested
    @DisplayName("合法 access token 认证路径")
    class HappyPath {

        @Test
        @DisplayName("合法 access token 应在链内填充 SecurityContext 与 TenantContextHolder")
        void shouldPopulateContextForValidAccessToken() throws Exception {
            // Arrange
            UUID principalId = UUID.randomUUID();
            UUID tenantId = UUID.randomUUID();
            Instant issuedAt = Instant.now().minusSeconds(60);
            Instant expiresAt = Instant.now().plusSeconds(900);

            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + VALID_TOKEN);
            MockHttpServletResponse response = new MockHttpServletResponse();

            when(jwtTokenProvider.getTokenType(VALID_TOKEN))
                    .thenReturn(JwtTokenProvider.TYPE_ACCESS);
            when(jwtTokenProvider.getPrincipalIdFromToken(VALID_TOKEN))
                    .thenReturn(principalId);
            when(jwtTokenProvider.getTenantIdFromToken(VALID_TOKEN))
                    .thenReturn(tenantId);
            when(jwtTokenProvider.getEmailFromToken(VALID_TOKEN))
                    .thenReturn("user@example.com");
            when(jwtTokenProvider.getRolesFromToken(VALID_TOKEN))
                    .thenReturn(List.of("PLATFORM_ADMIN", "DESIGNER"));
            when(jwtTokenProvider.getSessionIdFromToken(VALID_TOKEN))
                    .thenReturn("session-001");
            when(jwtTokenProvider.getIssuedAtFromToken(VALID_TOKEN))
                    .thenReturn(issuedAt);
            when(jwtTokenProvider.getExpiresAtFromToken(VALID_TOKEN))
                    .thenReturn(expiresAt);

            // 在 filterChain.doFilter 调用时（filter 的 finally 之前）记录 SecurityContext 状态
            java.util.concurrent.atomic.AtomicReference<Authentication> authSnapshot =
                    new java.util.concurrent.atomic.AtomicReference<>();
            java.util.concurrent.atomic.AtomicReference<java.util.Optional<UUID>> tenantSnapshot =
                    new java.util.concurrent.atomic.AtomicReference<>();
            org.mockito.Mockito.doAnswer(inv -> {
                authSnapshot.set(SecurityContextHolder.getContext().getAuthentication());
                tenantSnapshot.set(TenantContextHolder.getTenantId());
                return null;
            }).when(filterChain).doFilter(request, response);

            // Act
            filter.doFilter(request, response, filterChain);

            // Assert：链内 SecurityContext 已填充
            Authentication auth = authSnapshot.get();
            assertThat(auth).isNotNull();
            assertThat(auth.getPrincipal()).isInstanceOf(AuthenticatedPrincipal.class);
            AuthenticatedPrincipal ap = (AuthenticatedPrincipal) auth.getPrincipal();
            assertThat(ap.principalId()).isEqualTo(principalId);
            assertThat(ap.tenantId()).isEqualTo(tenantId);
            assertThat(ap.email()).isEqualTo("user@example.com");
            assertThat(ap.roles()).containsExactly("PLATFORM_ADMIN", "DESIGNER");
            assertThat(ap.sessionId()).isEqualTo("session-001");
            assertThat(tenantSnapshot.get()).hasValue(tenantId);
            // 链结束后应清理（finally 块）
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            assertThat(TenantContextHolder.getTenantId()).isEmpty();
            verify(filterChain, times(1)).doFilter(request, response);
        }

        @Test
        @DisplayName("角色列表为空时应不报错，GrantedAuthority 列表为空")
        void shouldHandleEmptyRoles() throws Exception {
            // Arrange
            UUID principalId = UUID.randomUUID();
            UUID tenantId = UUID.randomUUID();
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + VALID_TOKEN);
            MockHttpServletResponse response = new MockHttpServletResponse();

            when(jwtTokenProvider.getTokenType(VALID_TOKEN))
                    .thenReturn(JwtTokenProvider.TYPE_ACCESS);
            when(jwtTokenProvider.getPrincipalIdFromToken(VALID_TOKEN))
                    .thenReturn(principalId);
            when(jwtTokenProvider.getTenantIdFromToken(VALID_TOKEN))
                    .thenReturn(tenantId);
            when(jwtTokenProvider.getEmailFromToken(VALID_TOKEN))
                    .thenReturn(null);
            when(jwtTokenProvider.getRolesFromToken(VALID_TOKEN))
                    .thenReturn(List.of());
            when(jwtTokenProvider.getSessionIdFromToken(VALID_TOKEN))
                    .thenReturn("session-002");
            when(jwtTokenProvider.getIssuedAtFromToken(VALID_TOKEN))
                    .thenReturn(Instant.now());
            when(jwtTokenProvider.getExpiresAtFromToken(VALID_TOKEN))
                    .thenReturn(Instant.now().plusSeconds(60));

            java.util.concurrent.atomic.AtomicReference<Authentication> authSnapshot =
                    new java.util.concurrent.atomic.AtomicReference<>();
            org.mockito.Mockito.doAnswer(inv -> {
                authSnapshot.set(SecurityContextHolder.getContext().getAuthentication());
                return null;
            }).when(filterChain).doFilter(request, response);

            // Act
            filter.doFilter(request, response, filterChain);

            // Assert：链内 Authentication 非空，authorities 为空
            Authentication auth = authSnapshot.get();
            assertThat(auth).isNotNull();
            assertThat(auth.getAuthorities()).isEmpty();
        }

        @Test
        @DisplayName("请求结束（链抛异常）后应清理 TenantContextHolder")
        void shouldClearTenantContextWhenChainThrows() throws Exception {
            // Arrange
            UUID principalId = UUID.randomUUID();
            UUID tenantId = UUID.randomUUID();
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.addHeader("Authorization", BEARER_PREFIX + VALID_TOKEN);
            MockHttpServletResponse response = new MockHttpServletResponse();

            when(jwtTokenProvider.getTokenType(VALID_TOKEN))
                    .thenReturn(JwtTokenProvider.TYPE_ACCESS);
            when(jwtTokenProvider.getPrincipalIdFromToken(VALID_TOKEN))
                    .thenReturn(principalId);
            when(jwtTokenProvider.getTenantIdFromToken(VALID_TOKEN))
                    .thenReturn(tenantId);
            when(jwtTokenProvider.getEmailFromToken(VALID_TOKEN))
                    .thenReturn("u@e.com");
            when(jwtTokenProvider.getRolesFromToken(VALID_TOKEN))
                    .thenReturn(List.of("USER"));
            when(jwtTokenProvider.getSessionIdFromToken(VALID_TOKEN))
                    .thenReturn("s-3");
            when(jwtTokenProvider.getIssuedAtFromToken(VALID_TOKEN))
                    .thenReturn(Instant.now());
            when(jwtTokenProvider.getExpiresAtFromToken(VALID_TOKEN))
                    .thenReturn(Instant.now().plusSeconds(60));

            // 模拟链中后续 filter 抛异常
            org.mockito.Mockito.doThrow(new RuntimeException("downstream fail"))
                    .when(filterChain).doFilter(any(), any());

            // Act + Assert：filter 应将异常透传
            boolean threw = false;
            try {
                filter.doFilter(request, response, filterChain);
            } catch (RuntimeException ex) {
                threw = true;
            }
            assertThat(threw).isTrue();

            // finally 块应已清理 TenantContextHolder
            assertThat(TenantContextHolder.getTenantId()).isEmpty();
            // SecurityContext 也应已清理
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        }
    }
}
