package com.platform.core.governance.flakycase.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Flaky Case 修复请求（D45.22：修复必须有最小回归样本和根因分类）
 */
public record FlakyResolveRequest(

        /** 根因分类（如 ENV_DEPENDENT/TIMING/DATA_RACE/ORDER_DEPENDENT） */
        @NotBlank(message = "rootCause is required")
        @Size(max = 500)
        String rootCause,

        /** 最小回归样本引用（如 testCaseId@commit） */
        @NotBlank(message = "regressionSample is required")
        @Size(max = 1000)
        String regressionSample
) {
}
