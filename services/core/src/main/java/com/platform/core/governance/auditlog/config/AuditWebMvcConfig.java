package com.platform.core.governance.auditlog.config;

import com.platform.core.governance.auditlog.service.AsyncAuditWriter;
import com.platform.core.governance.auditlog.support.AuditActionEvaluator;
import com.platform.core.governance.auditlog.support.AuditLogInterceptor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web MVC 配置
 *
 * 注册审计日志拦截器，拦截所有 /api/v1/** 写操作。
 *
 * 排除路径：
 *  - /api/v1/auth/login, /auth/refresh, /auth/logout：登录类操作走专用审计分支
 *    （登录审计含密码等敏感字段，需要在 AuthService 内单独脱敏后写入，
 *    而非通用拦截器自动记录）
 *  - /api/v1/audit-logs/**：避免审计查询本身又产生审计（递归噪音）
 *  - /api/v1/health, /actuator/**：健康检查不审计
 *  - /api/v1/backups/{id}/restore：恢复操作在 BackupService 中已自带审计逻辑
 *    （需要更详细的 stepUpToken 等字段记录）
 *
 * 使用 @ConditionalOnBean(AsyncAuditWriter.class) 让 @WebMvcTest 切片测试
 * （不会加载 @Service Bean）自动跳过此配置类，避免 ApplicationContext 加载失败。
 */
@Configuration
@ConditionalOnBean(AsyncAuditWriter.class)
public class AuditWebMvcConfig implements WebMvcConfigurer {

    private final AsyncAuditWriter asyncWriter;
    private final AuditActionEvaluator evaluator;

    public AuditWebMvcConfig(AsyncAuditWriter asyncWriter, AuditActionEvaluator evaluator) {
        this.asyncWriter = asyncWriter;
        this.evaluator = evaluator;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new AuditLogInterceptor(asyncWriter, evaluator))
                .addPathPatterns("/api/v1/**")
                .excludePathPatterns(
                        "/api/v1/auth/login",
                        "/api/v1/auth/refresh",
                        "/api/v1/auth/logout",
                        "/api/v1/audit-logs/**",
                        "/api/v1/health",
                        "/actuator/**"
                );
    }
}
