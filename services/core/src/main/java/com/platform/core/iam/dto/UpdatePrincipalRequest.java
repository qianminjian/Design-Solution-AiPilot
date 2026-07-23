package com.platform.core.iam.dto;

import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * 更新主体请求（部分更新，对齐 iam.contract.ts §UpdatePrincipalRequest）
 */
public record UpdatePrincipalRequest(
        @Size(max = 255, message = "显示名长度不能超过 255")
        String displayName,

        /** 状态：ACTIVE / DISABLED / LOCKED / PENDING */
        String status,

        String locale,

        String timezone,

        Map<String, Object> metadata
) {
}
