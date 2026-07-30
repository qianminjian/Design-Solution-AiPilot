package com.platform.core.governance.restore.dto;

import com.platform.core.governance.domain.enums.GovernanceRestoreDrillStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * 治理域灾备演练 DTO（对齐 BFF zod governanceRestoreDrillSchema）
 */
public record RestoreDrillDto(
        UUID id,
        UUID backupId,
        String target,
        GovernanceRestoreDrillStatus status,
        Instant startedAt,
        Instant completedAt,
        Integer actualRtoMin,
        Integer actualRpoMin,
        String verifier,
        String reportUrl,
        Boolean passed,
        String notes
) {
}
