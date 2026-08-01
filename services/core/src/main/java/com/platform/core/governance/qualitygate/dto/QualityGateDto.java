package com.platform.core.governance.qualitygate.dto;

import com.platform.core.governance.qualitygate.domain.QualityGateLevel;
import com.platform.core.governance.qualitygate.domain.QualityGateStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * 质量门禁响应 DTO（D45.23）
 */
public record QualityGateDto(
        UUID id,
        QualityGateLevel gateLevel,
        QualityGateStatus status,
        String versionTarget,
        String checks,
        String signerRole,
        UUID signedBy,
        Instant signedAt,
        String decision,
        boolean aiSigned,
        Instant createdAt,
        Instant updatedAt
) {
}
