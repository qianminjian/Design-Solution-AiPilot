package com.platform.core.compliance.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ComplianceRuleSetDto(
        UUID id,
        UUID tenantId,
        String name,
        String description,
        String stageCode,
        String status,
        List<RuleSetRuleDto> rules,
        Instant createdAt,
        Instant updatedAt,
        UUID createdBy,
        UUID updatedBy,
        Long rowVersion
) {
    public record RuleSetRuleDto(
            UUID revisionId,
            Integer priority
    ) {
    }
}