package com.platform.core.iam.dto;

import jakarta.validation.constraints.Size;

/**
 * 撤销 API Token 请求
 *
 * <p>reason 可选，用于审计追溯。
 */
public record RevokeApiTokenRequest(

        @Size(max = 255, message = "撤销原因长度不能超过 255 字符")
        String reason
) {
}
