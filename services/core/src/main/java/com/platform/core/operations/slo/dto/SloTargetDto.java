package com.platform.core.operations.slo.dto;

import com.platform.core.operations.domain.enums.SloStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * SLO 目标 DTO（对齐前端 SloTargetDto 契约）
 *
 * 用于 API 响应，所有字段与前端 TypeScript 类型保持一致。
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record SloTargetDto(
        UUID id,
        String name,
        BigDecimal availabilityTarget,
        BigDecimal availabilityCurrent,
        BigDecimal errorBudgetRemaining,
        long requestCount24h,
        long errorCount24h,
        int p95LatencyMs,
        int p99LatencyMs,
        SloStatus status,
        Instant updatedAt
) {
}
