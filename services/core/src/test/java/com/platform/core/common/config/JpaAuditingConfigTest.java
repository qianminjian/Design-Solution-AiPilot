package com.platform.core.common.config;

import com.platform.core.common.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.AuditorAware;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * JpaAuditingConfig 单元测试
 *
 * 覆盖：
 * - 无认证上下文时 auditorProvider 返回 Optional.empty()
 * - 有认证上下文时 auditorProvider 返回 principalId
 * - principal 类型未识别时返回 empty（不抛异常）
 *
 * 权威源：JpaAuditingConfig.java
 */
@DisplayName("JpaAuditingConfig 审计配置")
class JpaAuditingConfigTest {

    @AfterEach
    void clearContext() {
        // 清理 ThreadLocal，防测试间内存泄漏
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("无认证上下文时应返回 Optional.empty()")
    void auditorProviderShouldReturnEmptyWhenNoAuthentication() {
        // Arrange
        SecurityContextHolder.clearContext();
        JpaAuditingConfig config = new JpaAuditingConfig();

        // Act
        AuditorAware<UUID> provider = config.auditorProvider();
        Optional<UUID> auditor = provider.getCurrentAuditor();

        // Assert
        assertThat(auditor).isEmpty();
    }

    @Test
    @DisplayName("有认证上下文时应返回 principalId")
    void auditorProviderShouldReturnPrincipalIdWhenAuthenticated() {
        // Arrange
        UUID principalId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
                principalId,
                tenantId,
                "user@example.com",
                List.of("DESIGNER"),
                "session-001",
                Instant.now(),
                Instant.now().plusSeconds(300)
        );
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                principal, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
        JpaAuditingConfig config = new JpaAuditingConfig();

        // Act
        AuditorAware<UUID> provider = config.auditorProvider();
        Optional<UUID> auditor = provider.getCurrentAuditor();

        // Assert
        assertThat(auditor).hasValue(principalId);
    }

    @Test
    @DisplayName("principal 类型未识别时应返回 empty（不抛异常）")
    void auditorProviderShouldReturnEmptyWhenPrincipalTypeUnknown() {
        // Arrange
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "anonymous-string-principal", null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
        JpaAuditingConfig config = new JpaAuditingConfig();

        // Act
        AuditorAware<UUID> provider = config.auditorProvider();
        Optional<UUID> auditor = provider.getCurrentAuditor();

        // Assert
        assertThat(auditor).isEmpty();
    }
}
