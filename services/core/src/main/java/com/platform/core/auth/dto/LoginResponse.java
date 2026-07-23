package com.platform.core.auth.dto;

import java.util.List;
import java.util.UUID;

/**
 * 登录响应
 * 对齐 packages/shared/src/contracts/auth.contract.ts §LoginResponse
 *
 * 注意：
 * - access token 由 BFF 持有，浏览器不直接持有（BFF 模式）
 * - refresh token 通过 httpOnly Cookie 设置，此处仅返回标记
 * - passwordHash 绝不出现在响应中
 */
public record LoginResponse(
        PrincipalInfo principal,
        String accessToken,
        long accessTokenExpiresIn,
        boolean refreshTokenSet,
        TenantInfo tenant,
        List<String> roles,
        List<String> permissions
) {

    /** 主体摘要信息（不含密码、外部 ID 等敏感字段） */
    public record PrincipalInfo(
            UUID id,
            UUID tenantId,
            String email,
            String displayName,
            String type,
            String status,
            String locale,
            String timezone
    ) {
    }

    /** 租户摘要信息 */
    public record TenantInfo(
            UUID id,
            String name,
            String code,
            String region,
            String language
    ) {
    }
}
