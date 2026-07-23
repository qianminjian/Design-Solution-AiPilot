package com.platform.core.iam.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 成员关系响应 DTO
 */
public record MembershipDto(
        UUID id,
        UUID tenantId,
        UUID principalId,
        UUID organizationId,
        String role,
        String status,
        Instant joinedAt,
        Instant effectiveFrom,
        Instant effectiveTo,
        Instant createdAt,
        Instant updatedAt,
        Long rowVersion
) {
}
