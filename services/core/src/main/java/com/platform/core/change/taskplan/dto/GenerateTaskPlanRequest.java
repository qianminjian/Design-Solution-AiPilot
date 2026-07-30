package com.platform.core.change.taskplan.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 生成处置任务请求（D37.16 P12）
 *
 * <p>用于自动生成处置任务（基于受影响项）。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record GenerateTaskPlanRequest(
        /** 生成策略：AUTO（基于规则自动生成）/ MANUAL（仅创建空模板） */
        String strategy,

        /** 默认责任人（AUTO 策略下使用） */
        @NotBlank(message = "defaultAssignee 不能为空")
        @Size(max = 200)
        String defaultAssignee,

        /** 默认完成时间（AUTO 策略下使用） */
        String defaultDueDate
) {
}
