package com.platform.core.compliance.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 合规发现 DTO（D45.22 缺陷治理 / D45.25 Finding API）
 *
 * 字段对齐 SIT P0-13.1：
 *  severity/category/repro/affected requirement/artifact/root state/owner/SLA/fix/verification
 */
public record ComplianceFindingDto(
        UUID id,
        UUID tenantId,
        UUID resultId,
        String severity,
        String status,
        UUID assignedTo,
        String note,
        String category,
        String repro,
        String affectedRequirement,
        String artifact,
        String rootState,
        UUID owner,
        Instant slaDueAt,
        String fix,
        String verification,
        UUID verifiedBy,
        Instant verifiedAt,
        Instant createdAt,
        Instant updatedAt,
        UUID createdBy,
        UUID updatedBy,
        Long rowVersion
) {
}
