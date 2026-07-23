package com.platform.core.compliance.dto;

import java.time.Instant;
import java.util.UUID;

public record ComplianceRuleDto(
        UUID id,
        UUID tenantId,
        String ruleCode,
        String name,
        String category,
        UUID owner,
        String status,
        String description,
        String basis,
        Instant createdAt,
        Instant updatedAt,
        UUID createdBy,
        UUID updatedBy,
        Long rowVersion
) {
}