package com.platform.core.compliance.dto;

import java.time.Instant;
import java.util.UUID;

public record CheckResultDto(
        UUID id,
        UUID tenantId,
        UUID executionId,
        UUID objectId,
        String objectType,
        String outcome,
        String measuredValue,
        String threshold,
        String explanation,
        String evidenceJson,
        Instant createdAt,
        UUID createdBy,
        Long rowVersion
) {
}