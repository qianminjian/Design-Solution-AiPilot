package com.platform.core.iam.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * 创建主体请求
 * 对齐 iam.contract.ts §CreatePrincipalRequest
 */
public record CreatePrincipalRequest(
        @NotBlank(message = "邮箱不能为空")
        @Email(message = "邮箱格式不正确")
        String email,

        @NotBlank(message = "显示名不能为空")
        @Size(max = 255, message = "显示名长度不能超过 255")
        String displayName,

        @NotBlank(message = "密码不能为空")
        @Size(min = 8, max = 128, message = "密码长度需在 8-128 之间")
        String password,

        /** 主体类型，默认 USER */
        String type,

        /** 语言，默认 en */
        String locale,

        /** 时区，默认 UTC */
        String timezone,

        /** 外部 ID */
        String externalId,

        /** 元数据 JSON */
        Map<String, Object> metadata
) {
}
