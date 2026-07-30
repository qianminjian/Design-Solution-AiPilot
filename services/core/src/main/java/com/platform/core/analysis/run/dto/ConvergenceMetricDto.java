package com.platform.core.analysis.run.dto;

import com.platform.core.analysis.domain.enums.ConvergenceStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * 收敛指标 DTO（对齐前端 analysis.contract.ts ConvergenceMetricDto）
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record ConvergenceMetricDto(
        UUID id,
        UUID runId,
        int iteration,
        BigDecimal residual,
        ConvergenceStatus convergenceStatus,
        Instant occurredAt
) {
}
