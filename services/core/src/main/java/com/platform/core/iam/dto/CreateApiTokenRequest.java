package com.platform.core.iam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/**
 * 创建 API Token 请求
 *
 * <p>安全约束：
 * <ul>
 *   <li>name：3-100 字符，租户+主体范围内唯一</li>
 *   <li>scopes：至少 1 个，遵循最小权限原则</li>
 *   <li>expiresAt：必须晚于当前时间，且 ≤ 当前时间 + 90 天</li>
 * </ul>
 */
public record CreateApiTokenRequest(

        @NotBlank
        @Size(min = 3, max = 100, message = "Token 名称长度必须在 3-100 字符之间")
        String name,

        @NotEmpty(message = "至少选择一个 scope")
        List<@NotBlank String> scopes,

        /** 过期时间（ISO-8601 字符串，由 Controller 解析为 Instant） */
        @NotBlank
        String expiresAt
) {
}
