package com.platform.core.iam.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 用户偏好设置 DTO
 *
 * 注意：locale/timezone 字段属于 Principal，本 DTO 不返回；
 * 如需暴露可通过 PrincipalDto 获取或后续扩展为合并视图。
 */
public record UserPreferencesDto(
        UUID id,
        UUID principalId,
        String unitSystem,
        String currency,
        String theme,
        Boolean emailNotify,
        Boolean inAppNotify,
        Boolean dailyDigest,
        Boolean mentionNotify,
        Boolean showAiSafetyBanner,
        Boolean requireHumanReviewBadge,
        Instant createdAt,
        Instant updatedAt,
        Long rowVersion
) {
}
