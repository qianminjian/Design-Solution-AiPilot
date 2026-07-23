package com.platform.core.iam.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 角色绑定响应 DTO
 */
public record RoleBindingDto(
        UUID id,
        UUID tenantId,
        UUID principalId,
        String roleCode,
        String scopeType,
        UUID scopeId,
        String status,
        Instant grantedAt,
        UUID grantedBy,
        Instant effectiveFrom,
        Instant effectiveTo,
        Instant createdAt,
        Instant updatedAt,
        Long rowVersion
) {
}
