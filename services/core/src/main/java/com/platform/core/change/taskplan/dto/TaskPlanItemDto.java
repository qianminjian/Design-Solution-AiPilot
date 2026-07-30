package com.platform.core.change.taskplan.dto;

import com.platform.core.change.domain.enums.TaskPlanStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 处置任务 DTO（对齐 BFF zod taskPlanItemSchema）
 *
 * 用于 API 响应，所有字段与前端 TypeScript 类型保持一致。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record TaskPlanItemDto(
        UUID id,
        UUID changeId,
        String title,
        String description,
        String assignee,
        String discipline,
        TaskPlanStatus status,
        Instant dueDate,
        Instant completedAt,
        String completedBy,
        List<String> affectedItemIds,
        String priority,
        Integer sequenceOrder,
        boolean blocksClosure,
        String skipReason,
        String skipApprovedBy,
        Instant createdAt,
        Instant updatedAt
) {
}
