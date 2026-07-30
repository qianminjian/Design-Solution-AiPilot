package com.platform.core.governance.evidence.dto;

import com.platform.core.governance.domain.enums.GovernanceEvidencePackageStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 治理域证据包 DTO（对齐 BFF zod governanceEvidencePackageSchema）
 */
public record EvidencePackageDto(
        UUID id,
        String name,
        GovernanceEvidencePackageStatus status,
        String objectId,
        String objectType,
        List<EvidenceItemDto> items,
        String sealedBy,
        Instant sealedAt,
        String verifiedBy,
        Instant verifiedAt,
        String hash,
        Instant createdAt
) {

    public record EvidenceItemDto(
            UUID id,
            String source,
            String revision,
            String toolchain,
            String hash,
            Instant capturedAt
    ) {
    }
}
