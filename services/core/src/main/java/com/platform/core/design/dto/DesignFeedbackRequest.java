package com.platform.core.design.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 提交设计反馈请求
 */
public record DesignFeedbackRequest(
    @NotBlank @Size(max = 4096) String comment,
    @Min(1) @Max(5) Integer rating
) {}
