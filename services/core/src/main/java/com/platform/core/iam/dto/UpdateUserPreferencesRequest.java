package com.platform.core.iam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 更新用户偏好设置请求
 *
 * 所有字段必填（PUT 语义为整体替换）；
 * locale/timezone 不在此处更新，需通过 PrincipalController 更新核心身份字段。
 */
public record UpdateUserPreferencesRequest(

        @NotBlank
        @Pattern(regexp = "^(metric|imperial)$", message = "单位制仅支持 metric 或 imperial")
        String unitSystem,

        @NotBlank
        @Size(max = 10)
        String currency,

        @NotBlank
        @Pattern(regexp = "^(light|dark|system)$", message = "主题仅支持 light / dark / system")
        String theme,

        @NotNull
        Boolean emailNotify,

        @NotNull
        Boolean inAppNotify,

        @NotNull
        Boolean dailyDigest,

        @NotNull
        Boolean mentionNotify,

        @NotNull
        Boolean showAiSafetyBanner,

        @NotNull
        Boolean requireHumanReviewBadge
) {
}
