package com.platform.core.change.request.dto;

import com.platform.core.change.domain.enums.ChangePriority;
import com.platform.core.change.domain.enums.ChangeStatus;
import com.platform.core.change.domain.enums.ChangeType;

import java.time.Instant;
import java.util.UUID;

/**
 * 变更请求 DTO（对齐 BFF zod changeRequestSchema）
 *
 * 用于 API 响应，所有字段与前端 TypeScript 类型保持一致。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record ChangeRequestDto(
        UUID id,
        String code,
        String title,
        String description,
        ChangeType type,
        ChangePriority priority,
        ChangeStatus status,
        String projectId,
        String baselineId,
        String initiatedBy,
        Instant initiatedAt,
        String approvedBy,
        Instant approvedAt,
        String implementedBy,
        Instant implementedAt,
        String closedBy,
        Instant closedAt,
        boolean confirmedNoImpact,
        boolean isAiAssisted,
        String riskAssessment,
        Instant createdAt,
        Instant updatedAt
) {
}
