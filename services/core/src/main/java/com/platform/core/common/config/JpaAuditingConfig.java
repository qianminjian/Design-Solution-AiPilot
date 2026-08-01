package com.platform.core.common.config;

import com.platform.core.common.security.AuthenticatedPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.UUID;

/**
 * JPA 审计配置
 *
 * 启用 Spring Data JPA 审计功能，自动填充 created_by/updated_by 字段。
 *
 * 实现说明：
 *  - 从 SecurityContext 获取当前认证主体 AuthenticatedPrincipal
 *  - 返回 principalId（UUID）作为审计字段值
 *  - 无认证上下文（如系统任务、Flyway 迁移）返回 empty，由数据库默认值兜底
 *
 * 安全红线（security.md §1）：
 *  - 不读取 x-user-id 请求头（防客户端伪造）
 *  - 仅从 SecurityContext 取得 JWT 解析后的身份信息
 */
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class JpaAuditingConfig {

    private static final Logger log = LoggerFactory.getLogger(JpaAuditingConfig.class);

    @Bean
    public AuditorAware<UUID> auditorProvider() {
        return () -> {
            SecurityContext context = SecurityContextHolder.getContext();
            Authentication authentication = context.getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()) {
                return Optional.empty();
            }
            Object principal = authentication.getPrincipal();
            if (principal instanceof AuthenticatedPrincipal authenticated) {
                return Optional.ofNullable(authenticated.principalId());
            }
            log.debug("JPA 审计跳过：未识别的 principal 类型 {}",
                    principal != null ? principal.getClass().getName() : "null");
            return Optional.empty();
        };
    }
}
