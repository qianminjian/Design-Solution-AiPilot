package com.platform.core.compliance.dto;

import java.time.Instant;
import java.util.UUID;

public record RuleRevisionDto(
        UUID id,
        UUID tenantId,
        UUID ruleId,
        Long revisionNo,
        String dslJson,
        String parametersJson,
        String basis,
        String engineProfile,
        String status,
        Instant createdAt,
        UUID createdBy,
        Long rowVersion
) {
}