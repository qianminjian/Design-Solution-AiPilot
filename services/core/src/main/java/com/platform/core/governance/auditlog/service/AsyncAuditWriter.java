package com.platform.core.governance.auditlog.service;

import com.platform.core.governance.auditlog.domain.AuditActor;
import com.platform.core.governance.auditlog.domain.AuditLog;
import com.platform.core.governance.auditlog.domain.AuditObject;
import com.platform.core.governance.auditlog.repository.AuditLogRepository;
import com.platform.core.governance.domain.enums.GovernanceAuditActorType;
import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceResult;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * 异步审计日志写入器
 *
 * 设计原则：
 *  - 异步写入（@Async），不阻塞主请求线程
 *  - 异常容错：写入失败仅记录日志，不抛异常（避免影响主流程）
 *  - 自动脱敏：通过 masked=true 标记敏感字段已脱敏
 *
 * 使用 Async 配置：见 @EnableAsync 启用，默认使用 SimpleAsyncTaskExecutor
 * V2 可切换为 ThreadPoolTaskExecutor 限制并发数。
 */
@Service
public class AsyncAuditWriter {

    private static final Logger log = LoggerFactory.getLogger(AsyncAuditWriter.class);

    private final AuditLogRepository repository;

    public AsyncAuditWriter(AuditLogRepository repository) {
        this.repository = repository;
    }

    /**
     * 异步写入审计日志
     *
     * @param tenantId   租户 ID
     * @param timestamp  事件时间
     * @param actor      执行者
     * @param action     操作名
     * @param category   分类
     * @param object     操作对象
     * @param traceId     链路追踪 ID
     * @param result     结果
     * @param riskLevel  风险等级
     * @param masked     是否脱敏
     * @param ipAddress   IP 地址
     * @param userAgent   User-Agent
     * @param details     详细信息（已脱敏）
     */
    @Async
    public void writeAsync(
            UUID tenantId,
            Instant timestamp,
            AuditActor actor,
            String action,
            GovernanceAuditCategory category,
            AuditObject object,
            String traceId,
            GovernanceResult result,
            GovernanceRiskLevel riskLevel,
            boolean masked,
            String ipAddress,
            String userAgent,
            String details
    ) {
        try {
            AuditLog entity = new AuditLog();
            entity.setTenantId(tenantId);
            entity.setTimestamp(timestamp);
            entity.setActor(actor);
            entity.setAction(action);
            entity.setCategory(category);
            entity.setObject(object);
            entity.setTraceId(traceId != null ? traceId : "unknown");
            entity.setResult(result);
            entity.setRiskLevel(riskLevel);
            entity.setMasked(masked);
            entity.setIpAddress(ipAddress != null ? ipAddress : "unknown");
            entity.setUserAgent(userAgent != null ? userAgent : "unknown");
            entity.setDetails(details != null ? details : "");
            repository.save(entity);
        } catch (Exception ex) {
            // 审计日志写入失败不能影响主流程
            log.error(
                    "Failed to write audit log: action={}, category={}, traceId={}, error={}",
                    action, category, traceId, ex.getMessage(), ex);
        }
    }

    /**
     * 构建匿名 system actor（用于无认证场景或系统自动触发）
     */
    public static AuditActor systemActor() {
        return new AuditActor(
                "system",
                "System",
                GovernanceAuditActorType.SYSTEM
        );
    }

    /**
     * 构建匿名 actor（用于认证缺失时兜底）
     */
    public static AuditActor anonymousActor() {
        return new AuditActor(
                "anonymous",
                "Anonymous",
                GovernanceAuditActorType.USER
        );
    }
}
