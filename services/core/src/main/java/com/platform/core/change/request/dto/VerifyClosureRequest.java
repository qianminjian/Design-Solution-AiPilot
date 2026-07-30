package com.platform.core.change.request.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 验证关闭请求 DTO
 *
 * 安全红线：
 * - 责任确认必须明确（responsibilityAcknowledged = true）
 * - 必须提供 stepUpToken 二次认证
 * - 关闭人与批准人/实施人职责分离
 * - Unknown 影响项阻断关闭
 * - 所有任务必须完成，所有证据必须已验证
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record VerifyClosureRequest(
        @NotBlank @Size(max = 50) String verificationResult,
        @Size(max = 2000) String comment,
        @NotBlank String stepUpToken,
        boolean responsibilityAcknowledged
) {
}
