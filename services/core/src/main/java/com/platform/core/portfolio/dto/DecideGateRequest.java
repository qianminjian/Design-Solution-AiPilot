package com.platform.core.portfolio.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/**
 * 门禁决策请求（对齐 portfolio.contract.ts §DecideGateRequest）
 *
 * @param decision   决策结论：APPROVED / CONDITIONALLY_APPROVED / REWORK_REQUIRED / SUSPENDED / CANCELLED
 * @param comment    决策意见
 * @param baselineId 关联基线 ID（核心不变量：必须为 PUBLISHED 状态基线，由服务层校验）
 * @param evidence   证据列表
 */
public record DecideGateRequest(
        @NotBlank(message = "决策结论不能为空")
        String decision,

        @NotBlank(message = "决策意见不能为空")
        @Size(max = 5000, message = "决策意见长度不能超过 5000")
        String comment,

        UUID baselineId,

        List<Object> evidence
) {
}
