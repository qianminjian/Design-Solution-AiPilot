package com.platform.core.governance.dataasset.dto;

import com.platform.core.governance.domain.enums.GovernanceDataAssetStatus;
import com.platform.core.governance.domain.enums.GovernanceDataAssetType;
import com.platform.core.governance.domain.enums.GovernanceDataClassification;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 治理域数据资产 DTO（对齐 BFF zod governanceDataAssetSchema）
 */
public record DataAssetDto(
        UUID id,
        GovernanceDataAssetType type,
        String name,
        String domain,
        String owner,
        String ownerEmail,
        GovernanceDataClassification classification,
        RetentionPolicy retention,
        double qualityScore,
        int qualityIssues,
        double lineageCoverage,
        List<String> storageLocations,
        GovernanceDataAssetStatus status,
        Instant lastModified,
        String description
) {

    public record RetentionPolicy(int years, boolean legalHold, Instant disposalDate) {
    }
}
