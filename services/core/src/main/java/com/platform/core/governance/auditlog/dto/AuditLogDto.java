package com.platform.core.governance.auditlog.dto;

import com.platform.core.governance.domain.enums.GovernanceAuditActorType;
import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceResult;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;

import java.time.Instant;
import java.util.UUID;

/**
 * 治理域审计日志 DTO（对齐 BFF zod governanceAuditLogSchema）
 *
 * P0-1.2 测试数据隔离：testRunId 用于前端可视化区分测试与生产数据
 *  - null：生产或未标记数据
 *  - 非空：CI 流水线标记的测试运行数据
 */
public record AuditLogDto(
        UUID id,
        Instant timestamp,
        Actor actor,
        String action,
        GovernanceAuditCategory category,
        AuditObject object,
        String traceId,
        GovernanceResult result,
        GovernanceRiskLevel riskLevel,
        boolean masked,
        String ipAddress,
        String userAgent,
        String details,
        String testRunId
) {

    public record Actor(String id, String name, GovernanceAuditActorType type) {
    }

    public record AuditObject(String type, String id, String name) {
    }
}
