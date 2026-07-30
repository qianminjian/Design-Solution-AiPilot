package com.platform.core.analysis.result.dto;

import com.platform.core.analysis.domain.enums.QualityDecision;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 提交结果质量评估请求
 *
 * <p>安全红线：
 *  - 决策 ACCEPT_AS_REVISION/EXCEPTION 需注册师签章
 *  - 高风险决策需 stepUpToken 二次认证
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record SubmitQualityAssessmentRequest(
        @NotNull QualityDecision decision,
        String checklist,
        @NotBlank @Size(max = 4000) String comment,
        @NotBlank @Size(max = 200) String assessorId,
        @NotBlank @Size(max = 100) String assessorRole,
        @Size(max = 200) String assessorQualification,
        String stepUpToken,
        String sealId
) {
}
