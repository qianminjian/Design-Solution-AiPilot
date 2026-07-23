package com.platform.core.tevv.dto;

import com.platform.core.tevv.domain.VerificationType;

import java.util.UUID;

/**
 * 创建验证项请求
 */
public record CreateVerificationItemRequest(
    UUID datasetId,
    String itemCode,
    String title,
    String description,
    Short gateNumber,
    VerificationType verificationType,
    String riskLevel
) {}
