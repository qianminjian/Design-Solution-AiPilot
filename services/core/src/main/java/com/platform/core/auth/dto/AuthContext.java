package com.platform.core.auth.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 当前登录上下文（GET /api/v1/auth/me）
 * 对齐 packages/shared/src/contracts/auth.contract.ts §AuthContext
 */
public record AuthContext(
        PrincipalInfo principal,
        TenantInfo tenant,
        List<String> roles,
        List<String> permissions,
        SessionInfo session
) {

    /** 主体摘要信息 */
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

    /** 会话信息（来自 JWT claims） */
    public record SessionInfo(
            String id,
            Instant issuedAt,
            Instant expiresAt
    ) {
    }
}
