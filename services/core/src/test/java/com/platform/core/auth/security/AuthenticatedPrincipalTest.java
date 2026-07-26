package com.platform.core.auth.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link AuthenticatedPrincipal} 单元测试
 *
 * <p>AuthenticatedPrincipal 作为 Spring Security Authentication 的 principal 对象，
 * 由 JwtAuthenticationFilter 从 access token 解析后填充。
 *
 * <p>验证点：
 * <ul>
 *   <li>record 字段可正确构造与读取</li>
 *   <li>record 不可变性：相同组件值的两实例 equals/hashCode 一致</li>
 *   <li>toString 输出包含字段名</li>
 * </ul>
 */
@DisplayName("AuthenticatedPrincipal 已认证主体")
class AuthenticatedPrincipalTest {

    @Test
    @DisplayName("构造时应正确填充所有字段")
    void shouldPopulateAllFieldsOnConstruction() {
        // Arrange
        UUID principalId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        String email = "architect@example.com";
        List<String> roles = List.of("ROLE_ARCHITECT", "ROLE_REVIEWER");
        String sessionId = "session-001";
        Instant issuedAt = Instant.parse("2026-07-26T08:00:00Z");
        Instant expiresAt = Instant.parse("2026-07-26T08:15:00Z");

        // Act
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
                principalId, tenantId, email, roles, sessionId, issuedAt, expiresAt
        );

        // Assert
        assertThat(principal.principalId()).isEqualTo(principalId);
        assertThat(principal.tenantId()).isEqualTo(tenantId);
        assertThat(principal.email()).isEqualTo(email);
        assertThat(principal.roles()).containsExactly("ROLE_ARCHITECT", "ROLE_REVIEWER");
        assertThat(principal.sessionId()).isEqualTo(sessionId);
        assertThat(principal.issuedAt()).isEqualTo(issuedAt);
        assertThat(principal.expiresAt()).isEqualTo(expiresAt);
    }

    @Test
    @DisplayName("相同字段值的两实例应相等且 hashCode 一致")
    void shouldBeEqualWhenFieldsAreIdentical() {
        // Arrange
        UUID principalId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        Instant issuedAt = Instant.parse("2026-07-26T08:00:00Z");
        Instant expiresAt = Instant.parse("2026-07-26T08:15:00Z");
        List<String> roles = List.of("ROLE_ARCHITECT");

        // Act
        AuthenticatedPrincipal p1 = new AuthenticatedPrincipal(
                principalId, tenantId, "user@example.com", roles, "s1", issuedAt, expiresAt
        );
        AuthenticatedPrincipal p2 = new AuthenticatedPrincipal(
                principalId, tenantId, "user@example.com", roles, "s1", issuedAt, expiresAt
        );

        // Assert
        assertThat(p1).isEqualTo(p2);
        assertThat(p1.hashCode()).isEqualTo(p2.hashCode());
    }

    @Test
    @DisplayName("不同 sessionId 的实例应不相等")
    void shouldNotBeEqualWhenSessionIdDiffers() {
        // Arrange
        UUID principalId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        Instant issuedAt = Instant.parse("2026-07-26T08:00:00Z");
        Instant expiresAt = Instant.parse("2026-07-26T08:15:00Z");
        List<String> roles = List.of("ROLE_ARCHITECT");

        // Act
        AuthenticatedPrincipal p1 = new AuthenticatedPrincipal(
                principalId, tenantId, "user@example.com", roles, "session-a", issuedAt, expiresAt
        );
        AuthenticatedPrincipal p2 = new AuthenticatedPrincipal(
                principalId, tenantId, "user@example.com", roles, "session-b", issuedAt, expiresAt
        );

        // Assert
        assertThat(p1).isNotEqualTo(p2);
    }

    @Test
    @DisplayName("空 roles 列表应被保留（不替换为 null）")
    void shouldPreserveEmptyRolesList() {
        // Arrange
        UUID principalId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        Instant issuedAt = Instant.parse("2026-07-26T08:00:00Z");
        Instant expiresAt = Instant.parse("2026-07-26T08:15:00Z");

        // Act
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
                principalId, tenantId, "user@example.com", List.of(), "s1", issuedAt, expiresAt
        );

        // Assert
        assertThat(principal.roles()).isNotNull().isEmpty();
    }

    @Test
    @DisplayName("roles 列表应为不可变（调用 add 应抛 UnsupportedOperationException）")
    void rolesListShouldBeImmutable() {
        // Arrange
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
                UUID.randomUUID(), UUID.randomUUID(), "user@example.com",
                List.of("ROLE_ARCHITECT"), "s1",
                Instant.parse("2026-07-26T08:00:00Z"),
                Instant.parse("2026-07-26T08:15:00Z")
        );

        // Act & Assert
        assertThat(principal.roles()).isInstanceOf(List.class);
        org.junit.jupiter.api.Assertions.assertThrows(
                UnsupportedOperationException.class,
                () -> principal.roles().add("ROLE_NEW")
        );
    }

    @Test
    @DisplayName("toString 应包含字段名与值")
    void toStringShouldContainFieldNamesAndValues() {
        // Arrange
        UUID principalId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000002");
        Instant issuedAt = Instant.parse("2026-07-26T08:00:00Z");
        Instant expiresAt = Instant.parse("2026-07-26T08:15:00Z");

        // Act
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
                principalId, tenantId, "architect@example.com",
                List.of("ROLE_ARCHITECT"), "session-001",
                issuedAt, expiresAt
        );

        // Assert
        String str = principal.toString();
        assertThat(str).contains("principalId");
        assertThat(str).contains("tenantId");
        assertThat(str).contains("architect@example.com");
        assertThat(str).contains("session-001");
    }
}
