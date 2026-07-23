package com.platform.core.auth.security;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 已认证主体信息
 * 作为 Spring Security Authentication 的 principal 对象
 * 由 JwtAuthenticationFilter 从 access token 解析后填充
 *
 * 不可变 record，避免在请求处理过程中被篡改
 */
public record AuthenticatedPrincipal(
        UUID principalId,
        UUID tenantId,
        String email,
        List<String> roles,
        String sessionId,
        Instant issuedAt,
        Instant expiresAt
) {
}
