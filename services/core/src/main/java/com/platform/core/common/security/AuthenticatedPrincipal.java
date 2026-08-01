package com.platform.core.common.security;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 已认证主体信息（共享 SPI）
 *
 * <p>作为 Spring Security Authentication 的 principal 对象，
 * 由 auth 域 JwtAuthenticationFilter 从 access token 解析后填充。
 *
 * <p>A-61 P1-3 修复：从 auth.security 包迁移到 common.security 包，
 * 让 operations / governance / cde 等业务域依赖 common 域而非 auth 域，
 * 解除业务域对 auth 域的反向依赖。
 *
 * <p>不可变 record，避免在请求处理过程中被篡改。
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
