package com.platform.core.analysis.run.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 运行时间线事件 DTO（对齐前端 analysis.contract.ts RunTimelineEventDto）
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record RunTimelineEventDto(
        UUID id,
        UUID runId,
        String eventType,
        String statusFrom,
        String statusTo,
        Instant occurredAt,
        Integer durationMs,
        String operatorId,
        String message,
        String metadata,
        String traceId,
        Instant createdAt
) {
}
