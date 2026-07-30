package com.platform.core.change.taskplan.dto;

import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * 更新处置任务请求（D37.16 P12）
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record UpdateTaskPlanItemRequest(
        @Size(max = 500)
        String title,

        @Size(max = 2000)
        String description,

        @Size(max = 200)
        String assignee,

        @Size(max = 64)
        String discipline,

        Instant dueDate,

        @Size(max = 16)
        String priority,

        Integer sequenceOrder,

        Boolean blocksClosure
) {
}
