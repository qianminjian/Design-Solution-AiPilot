package com.platform.core.analysis.problem.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 标记工程分析问题失效请求
 *
 * <p>安全红线：invalidate 为高风险动作，需 stepUpToken 二次认证。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record InvalidateProblemRequest(
        @NotBlank @Size(max = 1000) String reason,
        String stepUpToken
) {
}
