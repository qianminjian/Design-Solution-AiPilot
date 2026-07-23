package com.platform.core.compliance.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ComplianceCheckRunDto(
        UUID id,
        UUID tenantId,
        UUID projectId,
        UUID ruleSetId,
        String status,
        String outcomeSummary,
        List<RuleExecutionDto> executions,
        Instant startedAt,
        Instant completedAt,
        Instant createdAt,
        Instant updatedAt,
        UUID createdBy,
        UUID updatedBy,
        Long rowVersion
) {
}