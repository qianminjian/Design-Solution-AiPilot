package com.platform.core.governance.auditlog.dto;

import com.platform.core.governance.domain.enums.GovernanceAuditActorType;
import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceResult;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;

import java.time.Instant;
import java.util.UUID;

/**
 * 治理域审计日志 DTO（对齐 BFF zod governanceAuditLogSchema）
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
        String details
) {

    public record Actor(String id, String name, GovernanceAuditActorType type) {
    }

    public record AuditObject(String type, String id, String name) {
    }
}
