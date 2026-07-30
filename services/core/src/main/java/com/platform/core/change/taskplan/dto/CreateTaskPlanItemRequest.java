package com.platform.core.change.taskplan.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

/**
 * 创建处置任务请求（D37.16 P12）
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record CreateTaskPlanItemRequest(
        @NotBlank(message = "title 不能为空")
        @Size(max = 500)
        String title,

        @Size(max = 2000)
        String description,

        @NotBlank(message = "assignee 不能为空")
        @Size(max = 200)
        String assignee,

        @Size(max = 64)
        String discipline,

        @NotNull(message = "dueDate 不能为空")
        Instant dueDate,

        List<String> affectedItemIds,

        @Size(max = 16)
        String priority,

        Integer sequenceOrder,

        boolean blocksClosure
) {
}
