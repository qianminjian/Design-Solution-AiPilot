package com.platform.core.governance.flakycase.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Flaky Case 运行结果上报请求（D45.22 Flaky 检测机制）
 */
public record FlakyReportRequest(

        /** 测试用例 ID */
        @NotBlank(message = "testCaseId is required")
        @Size(max = 200)
        String testCaseId,

        /** 对应 Requirement ID */
        @NotBlank(message = "requirementId is required")
        @Size(max = 200)
        String requirementId,

        /** 本次运行结果 */
        Boolean passed,

        /** 关联测试运行 ID（对齐 P0-1.2） */
        @Size(max = 64)
        String testRunId
) {
}
