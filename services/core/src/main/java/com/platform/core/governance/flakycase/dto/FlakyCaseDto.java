package com.platform.core.governance.flakycase.dto;

import com.platform.core.governance.flakycase.domain.FlakyCaseStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * Flaky Case 响应 DTO（D45.22）
 */
public record FlakyCaseDto(
        UUID id,
        FlakyCaseStatus status,
        String testCaseId,
        String requirementId,
        int runCount,
        int instabilityCount,
        int consecutiveUnstable,
        Boolean lastResult,
        String rootCause,
        String regressionSample,
        String replacementCaseId,
        String testRunId,
        Instant createdAt,
        Instant updatedAt
) {
}
