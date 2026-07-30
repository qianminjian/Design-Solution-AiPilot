package com.platform.core.governance.backup.dto;

import com.platform.core.governance.domain.enums.GovernanceBackupScope;
import com.platform.core.governance.domain.enums.GovernanceBackupStatus;
import com.platform.core.governance.domain.enums.GovernanceBackupType;

import java.time.Instant;
import java.util.UUID;

/**
 * 治理域备份点 DTO（对齐 BFF zod governanceBackupPointSchema）
 */
public record BackupPointDto(
        UUID id,
        GovernanceBackupType type,
        GovernanceBackupScope scope,
        Instant startedAt,
        Instant completedAt,
        Integer durationSec,
        long sizeBytes,
        int objectCount,
        GovernanceBackupStatus status,
        int actualRpoMin,
        String storageLocation,
        String hash,
        String triggeredBy
) {
}
