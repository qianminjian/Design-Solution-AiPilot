package com.platform.core.tevv.dto;

import com.platform.core.tevv.domain.DatasetCategory;

/**
 * 创建金样数据集请求
 */
public record CreateDatasetRequest(
    String name,
    String description,
    DatasetCategory category,
    String buildingType,
    String storageKey
) {}
