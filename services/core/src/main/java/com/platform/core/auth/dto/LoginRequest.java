package com.platform.core.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 登录请求
 * 对齐 packages/shared/src/contracts/auth.contract.ts §LoginRequest
 *
 * 安全规则：
 * - 登录失败不暴露具体原因（防枚举），统一返回"邮箱或密码错误"
 * - 密码不打印到日志（见 security.md §3 / §12）
 */
public record LoginRequest(

        @NotBlank(message = "邮箱不能为空")
        @Email(message = "邮箱格式不正确")
        String email,

        @NotBlank(message = "密码不能为空")
        @Size(min = 1, max = 128, message = "密码长度不能超过 128")
        String password,

        /** 是否记住此设备（延长 refresh token 有效期，V1 暂不实现差异化） */
        Boolean rememberMe
) {
}
