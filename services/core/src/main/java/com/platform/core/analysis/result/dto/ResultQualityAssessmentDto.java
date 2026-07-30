package com.platform.core.analysis.result.dto;

import com.platform.core.analysis.domain.enums.QualityDecision;

import java.time.Instant;
import java.util.UUID;

/**
 * 结果质量评估 DTO（对齐前端 analysis.contract.ts ResultQualityAssessmentDto）
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record ResultQualityAssessmentDto(
        UUID id,
        UUID resultId,
        QualityDecision decision,
        String checklist,
        String comment,
        String assessorId,
        String assessorRole,
        String assessorQualification,
        boolean requiresSeal,
        String sealId,
        Instant sealedAt,
        Instant assessedAt,
        Instant createdAt
) {
}
