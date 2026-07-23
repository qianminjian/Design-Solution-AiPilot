package com.platform.core.tevv.dto;

import com.platform.core.tevv.domain.VerificationStatus;
import com.platform.core.tevv.domain.VerificationType;

import java.time.Instant;
import java.util.UUID;

/**
 * 验证项 DTO
 */
public record VerificationItemDto(
    UUID id,
    UUID datasetId,
    String itemCode,
    String title,
    String description,
    Short gateNumber,
    VerificationType verificationType,
    String riskLevel,
    VerificationStatus status,
    String evidenceRefs,
    UUID verifiedBy,
    Instant verifiedAt,
    String waiverReason
) {}
