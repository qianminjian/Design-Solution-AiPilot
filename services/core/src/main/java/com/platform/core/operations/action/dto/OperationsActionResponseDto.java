package com.platform.core.operations.action.dto;

import com.platform.core.operations.domain.enums.OperationsActionStatus;
import com.platform.core.operations.domain.enums.OperationsActionType;

import java.time.Instant;

/**
 * Operations 主动作响应 DTO（对齐前端 OperationsActionResponseDto 契约）
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record OperationsActionResponseDto(
        String operationId,
        OperationsActionType actionType,
        String targetId,
        OperationsActionStatus status,
        Instant initiatedAt,
        Instant completedAt,
        int affectedCount,
        String auditTraceId
) {
}
