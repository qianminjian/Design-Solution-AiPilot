package com.platform.core.compliance.dto;

import java.time.Instant;
import java.util.UUID;

public record ComplianceFindingDto(
        UUID id,
        UUID tenantId,
        UUID resultId,
        String severity,
        String status,
        UUID assignedTo,
        String note,
        Instant createdAt,
        Instant updatedAt,
        UUID createdBy,
        UUID updatedBy,
        Long rowVersion
) {
}