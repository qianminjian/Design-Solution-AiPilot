package com.platform.core.change.request.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 批准变更请求 DTO
 *
 * 安全红线：
 * - 责任确认必须明确（responsibilityAcknowledged = true）
 * - 必须提供 stepUpToken 二次认证
 * - 批准人与实施人/关闭人职责分离
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record ApproveChangeRequestRequest(
        @Size(max = 2000) String comment,
        @NotBlank String stepUpToken,
        boolean responsibilityAcknowledged
) {
}
