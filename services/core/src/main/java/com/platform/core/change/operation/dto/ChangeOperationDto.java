package com.platform.core.change.operation.dto;

import com.platform.core.change.domain.enums.ChangeOperationPhase;
import com.platform.core.change.domain.enums.ChangeOperationPhaseStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * 变更操作阶段 DTO（对齐 BFF zod changeOperationSchema）
 *
 * 用于 API 响应，所有字段与前端 TypeScript 类型保持一致。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record ChangeOperationDto(
        UUID id,
        UUID changeId,
        ChangeOperationPhase phase,
        ChangeOperationPhaseStatus status,
        String operatorId,
        Instant operatedAt,
        String comment,
        String fromStatus,
        String toStatus,
        Integer sequence,
        Instant createdAt
) {
}
