package com.platform.core.analysis.result.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 创建变更影响提案请求（结果 → 变更域）
 *
 * <p>安全红线：
 *  - 高风险动作，需 stepUpToken
 *  - 提案创建后进入变更域审批流程
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record ImpactProposalRequest(
        @NotBlank @Size(max = 500) String title,
        @NotBlank @Size(max = 4000) String rationale,
        @NotBlank @Size(max = 64) String projectId,
        String stepUpToken
) {
}
