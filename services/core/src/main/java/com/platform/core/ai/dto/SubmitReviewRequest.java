package com.platform.core.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * 提交人工复核决策请求
 *
 * 用于对 requiresHumanReview=true 的 AI 生成记录提交复核结论。
 * 风险等级 high/critical 须双人复核 + 注册师签章（security.md §12）。
 */
public record SubmitReviewRequest(
    /** 决策：APPROVED / REJECTED / RETURNED */
    @NotBlank
    @Pattern(regexp = "APPROVED|REJECTED|RETURNED", message = "决策须为 APPROVED/REJECTED/RETURNED")
    String decision,

    /** 复核意见 */
    @Size(max = 2000)
    String comment,

    /** 决策上下文（双人复核签章、注册师信息等） */
    Map<String, Object> decisionContext
) {}
