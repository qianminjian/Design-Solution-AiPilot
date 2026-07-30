package com.platform.core.governance.auditlog.dto;

import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceResult;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;

import java.time.Instant;

/**
 * 审计日志查询请求（对齐 BFF zod governanceAuditLogQuerySchema）
 *
 * 所有字段可选，组合过滤。
 */
public record AuditLogQuery(
        GovernanceAuditCategory category,
        GovernanceResult result,
        GovernanceRiskLevel riskLevel,
        String actorId,
        Instant from,
        Instant to,
        String traceId
) {
}
