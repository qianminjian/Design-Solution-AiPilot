package com.platform.core.common.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.AuditorAware;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * JpaAuditingConfig 单元测试
 *
 * 覆盖：
 * - auditorProvider bean 应返回 Optional.empty()
 *   （TODO: 集成认证后从 SecurityContext 获取当前用户 ID，当前为空）
 *
 * 权威源：JpaAuditingConfig.java
 */
@DisplayName("JpaAuditingConfig 审计配置")
class JpaAuditingConfigTest {

    @Test
    @DisplayName("auditorProvider 应返回 Optional.empty()")
    void auditorProviderShouldReturnEmpty() {
        // Arrange
        JpaAuditingConfig config = new JpaAuditingConfig();

        // Act
        AuditorAware<UUID> provider = config.auditorProvider();
        Optional<UUID> auditor = provider.getCurrentAuditor();

        // Assert
        assertThat(auditor).isEmpty();
    }

    @Test
    @DisplayName("多次调用应稳定返回 empty")
    void multipleCallsShouldStableReturnEmpty() {
        // Arrange
        JpaAuditingConfig config = new JpaAuditingConfig();
        AuditorAware<UUID> provider = config.auditorProvider();

        // Act & Assert
        for (int i = 0; i < 5; i++) {
            assertThat(provider.getCurrentAuditor()).isEmpty();
        }
    }
}
