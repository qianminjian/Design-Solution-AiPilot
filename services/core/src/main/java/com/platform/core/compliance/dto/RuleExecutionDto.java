package com.platform.core.compliance.dto;

import java.time.Instant;
import java.util.UUID;

public record RuleExecutionDto(
        UUID id,
        UUID tenantId,
        UUID runId,
        UUID revisionId,
        Long applicabilityCount,
        Long passCount,
        Long failCount,
        Long notApplicableCount,
        Long indeterminateCount,
        Long errorCount,
        Long manualReviewCount,
        String status,
        Long durationMs,
        String logs,
        Instant createdAt,
        Instant updatedAt,
        Long rowVersion
) {
}