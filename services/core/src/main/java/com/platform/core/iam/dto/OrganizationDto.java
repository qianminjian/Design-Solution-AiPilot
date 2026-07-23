package com.platform.core.iam.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 组织响应 DTO
 */
public record OrganizationDto(
        UUID id,
        UUID tenantId,
        UUID parentId,
        String name,
        String type,
        String status,
        String classification,
        String metadata,
        Instant createdAt,
        Instant updatedAt,
        Long rowVersion
) {
}
