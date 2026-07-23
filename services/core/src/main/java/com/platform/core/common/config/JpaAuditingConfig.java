package com.platform.core.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

import java.util.Optional;
import java.util.UUID;

/**
 * JPA 审计配置
 * 启用 Spring Data JPA 审计功能，自动填充 created_by/updated_by 等字段
 */
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class JpaAuditingConfig {

    @Bean
    public AuditorAware<UUID> auditorProvider() {
        // TODO: 集成认证后，从 SecurityContext 获取当前用户 ID
        // 当前返回空，由数据库默认值和触发器兜底
        return () -> Optional.empty();
    }
}
