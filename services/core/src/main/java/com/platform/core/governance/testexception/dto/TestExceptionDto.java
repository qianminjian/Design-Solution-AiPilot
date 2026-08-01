package com.platform.core.governance.testexception.dto;

import com.platform.core.governance.testexception.domain.TestExceptionStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * 测试例外响应 DTO（D45.22 / D45.25）
 */
public record TestExceptionDto(
        UUID id,
        TestExceptionStatus status,
        String scope,
        String reason,
        String risk,
        String compensation,
        String approvers,
        Instant expiry,
        String retestTrigger,
        String residualRisk,
        String versionTarget,
        String testRunId,
        Instant createdAt,
        Instant updatedAt
) {
}
