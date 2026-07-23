package com.platform.core.portfolio.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 阶段流转请求（对齐 portfolio.contract.ts §TransitionStageRequest）
 *
 * @param targetStatus 目标状态（D05.4.1 状态机校验由服务层执行）
 * @param comment      流转原因/备注
 */
public record TransitionStageRequest(
        @NotBlank(message = "目标状态不能为空")
        String targetStatus,

        @Size(max = 2000, message = "备注长度不能超过 2000")
        String comment
) {
}
