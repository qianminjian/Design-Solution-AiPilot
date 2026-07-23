package com.platform.core.tevv.dto;

import com.platform.core.tevv.domain.DatasetCategory;
import com.platform.core.tevv.domain.DatasetStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * 金样数据集 DTO
 */
public record GoldenDatasetDto(
    UUID id,
    String name,
    String description,
    DatasetCategory category,
    String buildingType,
    DatasetStatus status,
    String version,
    String storageKey,
    Integer fileCount,
    Long totalSizeBytes,
    Instant frozenAt,
    UUID frozenBy,
    Instant createdAt,
    UUID createdBy
) {}
