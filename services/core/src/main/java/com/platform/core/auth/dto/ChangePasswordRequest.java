package com.platform.core.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 修改密码请求
 * 对齐 packages/shared/src/contracts/auth.contract.ts §ChangePasswordRequest
 *
 * 安全规则：
 * - 新密码长度 8-128
 * - 必须包含字母 + 数字（在 Service 层校验复杂度）
 * - 密码不打印到日志
 */
public record ChangePasswordRequest(

        @NotBlank(message = "当前密码不能为空")
        String currentPassword,

        @NotBlank(message = "新密码不能为空")
        @Size(min = 8, max = 128, message = "新密码长度需在 8-128 之间")
        String newPassword
) {
}
