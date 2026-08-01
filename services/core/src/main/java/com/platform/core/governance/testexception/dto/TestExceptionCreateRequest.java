package com.platform.core.governance.testexception.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * 测试例外创建请求（D45.25：POST /test-exceptions）
 *
 * 字段对齐 SIT P0-13.3 路线图：
 *  scope/reason/risk/compensation/approvers/expiry/retest trigger/residual risk
 */
public record TestExceptionCreateRequest(

        /** 适用范围（requirementId/testCaseId/releaseId） */
        @NotBlank(message = "scope is required")
        @Size(max = 500)
        String scope,

        /** 例外理由 */
        @NotBlank(message = "reason is required")
        @Size(max = 2000)
        String reason,

        /** 风险等级：LOW/MEDIUM/HIGH/CRITICAL */
        @NotBlank(message = "risk is required")
        @Pattern(regexp = "LOW|MEDIUM|HIGH|CRITICAL", message = "risk must be LOW/MEDIUM/HIGH/CRITICAL")
        String risk,

        /** 补偿控制 */
        @NotBlank(message = "compensation is required")
        @Size(max = 2000)
        String compensation,

        /** 签署人列表（JSON 数组：{principalId, signedAt, comment}[]，验收：例外有签署） */
        @NotBlank(message = "approvers is required")
        String approvers,

        /** 到期时间（到期自动撤销） */
        @NotNull(message = "expiry is required")
        Instant expiry,

        /** 复测触发条件 */
        @Size(max = 1000)
        String retestTrigger,

        /** 残余风险 */
        @Size(max = 2000)
        String residualRisk,

        /** 绑定版本/Release（版本升级不自动继承） */
        @Size(max = 200)
        String versionTarget,

        /** 关联测试运行 ID（对齐 P0-1.2） */
        @Size(max = 64)
        String testRunId
) {
}
