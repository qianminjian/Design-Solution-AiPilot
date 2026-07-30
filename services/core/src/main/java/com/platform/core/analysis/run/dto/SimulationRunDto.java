package com.platform.core.analysis.run.dto;

import com.platform.core.analysis.domain.enums.RunStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * 模拟运行 DTO（对齐前端 analysis.contract.ts SimulationRunDto）
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record SimulationRunDto(
        UUID id,
        UUID problemId,
        UUID scenarioId,
        UUID solverProfileId,
        String solverProfileName,
        RunStatus status,
        Instant queuedAt,
        Instant startedAt,
        Instant completedAt,
        String solverVersion,
        Integer actualDurationSec,
        BigDecimal actualCost,
        String failureReason,
        int retryCount,
        UUID parentRunId,
        boolean isUnknownJob,
        String cancelledBy,
        String cancelReason,
        Instant createdAt,
        Instant updatedAt
) {
}
