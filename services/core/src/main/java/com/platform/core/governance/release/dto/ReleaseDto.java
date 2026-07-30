package com.platform.core.governance.release.dto;

import com.platform.core.governance.domain.enums.GovernanceMetricsDrift;
import com.platform.core.governance.domain.enums.GovernanceRedteamStatus;
import com.platform.core.governance.domain.enums.GovernanceReleaseStatus;
import com.platform.core.governance.domain.enums.GovernanceReleaseType;

import java.time.Instant;
import java.util.UUID;

/**
 * 治理域 Release DTO（对齐 BFF zod governanceReleaseSchema）
 */
public record ReleaseDto(
        UUID id,
        String name,
        GovernanceReleaseType type,
        String version,
        String previousVersion,
        GovernanceReleaseStatus status,
        String releaseManager,
        Instant createdAt,
        Instant promotedAt,
        double evalScore,
        int evalSlices,
        GovernanceRedteamStatus redteamStatus,
        int consumerCount,
        int canaryPercent,
        GovernanceMetricsDrift metricsDrift,
        boolean hasEvalGap,
        boolean hasOldConsumer,
        String description,
        DiffSummary diffSummary
) {

    public record DiffSummary(int added, int modified, int removed) {
    }
}
