package com.platform.core.governance.auditlog.dto;

import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceResult;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;

import java.time.Instant;

/**
 * 审计日志查询请求（对齐 BFF zod governanceAuditLogQuerySchema）
 *
 * 所有字段可选，组合过滤。
 *
 * P0-1.2 测试数据隔离：
 *  - testRunId 非空：按值精确过滤某次测试运行
 *  - excludeTestRun=true：仅返回生产数据（test_run_id IS NULL）
 *  - 两者同时传时，以 excludeTestRun 优先
 */
public record AuditLogQuery(
        GovernanceAuditCategory category,
        GovernanceResult result,
        GovernanceRiskLevel riskLevel,
        String actorId,
        Instant from,
        Instant to,
        String traceId,
        String testRunId,
        Boolean excludeTestRun
) {
}
