package com.platform.core.change.request.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 提交影响评估请求 DTO
 *
 * 安全红线：
 * - confirmedNoImpact 必须明确（区分"尚未分析"与"确认无影响"）
 * - stepUpToken 用于高风险变更二次认证
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record SubmitImpactAssessmentRequest(
        @NotBlank @Size(max = 4000) String impactAssessment,
        boolean confirmedNoImpact,
        String stepUpToken
) {
}
