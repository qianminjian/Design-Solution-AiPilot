package com.platform.core.cde.support;

import com.platform.core.common.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * CurrentUserResolver 单元测试
 *
 * <p>覆盖从 SecurityContext 提取 AuthenticatedPrincipal 的四种场景：
 * <ul>
 *   <li>无 Authentication（未登录）</li>
 *   <li>Authentication.isAuthenticated()=false</li>
 *   <li>principal 不是 AuthenticatedPrincipal 类型</li>
 *   <li>principal 是 AuthenticatedPrincipal（正常路径）</li>
 * </ul>
 *
 * <p>每个用例后通过 {@code @AfterEach} 清理 SecurityContext，避免线程间测试污染。
 */
@DisplayName("CurrentUserResolver 当前用户解析器")
class CurrentUserResolverTest {

    private final CurrentUserResolver resolver = new CurrentUserResolver();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Nested
    @DisplayName("getCurrentPrincipalId 当前主体 ID 解析")
    class GetCurrentPrincipalId {

        @Test
        @DisplayName("SecurityContext 为空时应返回 null")
        void shouldReturnNullWhenContextEmpty() {
            // Arrange：未设置 SecurityContext
            SecurityContextHolder.clearContext();

            // Act
            var result = resolver.getCurrentPrincipalId();

            // Assert
            assertThat(result).isNull();
        }

        @Test
        @DisplayName("Authentication.isAuthenticated()=false 时应返回 null")
        void shouldReturnNullWhenNotAuthenticated() {
            // Arrange
            Authentication auth = mock(Authentication.class);
            when(auth.isAuthenticated()).thenReturn(false);
            SecurityContextHolder.getContext().setAuthentication(auth);

            // Act
            var result = resolver.getCurrentPrincipalId();

            // Assert
            assertThat(result).isNull();
        }

        @Test
        @DisplayName("principal 非 AuthenticatedPrincipal 类型时应返回 null")
        void shouldReturnNullWhenPrincipalTypeMismatch() {
            // Arrange：principal 为 String 而非 AuthenticatedPrincipal
            Authentication auth = mock(Authentication.class);
            when(auth.isAuthenticated()).thenReturn(true);
            when(auth.getPrincipal()).thenReturn("anonymousUser");
            SecurityContextHolder.getContext().setAuthentication(auth);

            // Act
            var result = resolver.getCurrentPrincipalId();

            // Assert
            assertThat(result).isNull();
        }

        @Test
        @DisplayName("principal 为 AuthenticatedPrincipal 时应返回 principalId")
        void shouldReturnPrincipalIdWhenAuthenticated() {
            // Arrange
            UUID expectedPrincipalId = UUID.randomUUID();
            AuthenticatedPrincipal ap = new AuthenticatedPrincipal(
                    expectedPrincipalId,
                    UUID.randomUUID(),
                    "user@example.com",
                    List.of("DESIGNER"),
                    "session-001",
                    Instant.now().minusSeconds(60),
                    Instant.now().plusSeconds(900));
            Authentication auth = mock(Authentication.class);
            when(auth.isAuthenticated()).thenReturn(true);
            when(auth.getPrincipal()).thenReturn(ap);
            SecurityContextHolder.getContext().setAuthentication(auth);

            // Act
            var result = resolver.getCurrentPrincipalId();

            // Assert
            assertThat(result).isEqualTo(expectedPrincipalId);
        }
    }
}
