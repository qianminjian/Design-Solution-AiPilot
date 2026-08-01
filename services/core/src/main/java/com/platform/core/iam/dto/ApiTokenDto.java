package com.platform.core.iam.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * API Token DTO（列表/详情查询用，不含 token 明文）
 *
 * <p>安全约束：明文 token 仅在 {@link CreateApiTokenResponse} 中返回一次，
 * 本 DTO 仅返回 prefix（前 12 位）用于识别展示。
 */
public record ApiTokenDto(
        UUID id,
        UUID principalId,
        String name,
        String prefix,
        List<String> scopes,
        String status,
        Instant expiresAt,
        Instant lastUsedAt,
        Instant revokedAt,
        String revokedReason,
        Instant createdAt,
        Instant updatedAt,
        Long rowVersion
) {
}
