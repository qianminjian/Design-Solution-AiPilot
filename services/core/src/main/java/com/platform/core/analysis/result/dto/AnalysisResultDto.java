package com.platform.core.analysis.result.dto;

import com.platform.core.analysis.domain.enums.ResultQualityStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * 分析结果 DTO（对齐前端 analysis.contract.ts AnalysisResultDto）
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record AnalysisResultDto(
        UUID id,
        UUID runId,
        UUID problemId,
        String name,
        ResultQualityStatus qualityStatus,
        Instant generatedAt,
        BigDecimal sizeMb,
        String variables,
        String cases,
        int timeSteps,
        int spatialPoints,
        String metrics,
        String benchmarkComparison,
        String downloadUrl,
        UUID supersededBy,
        Instant supersededAt,
        Instant createdAt,
        Instant updatedAt
) {
}
