package com.platform.core.analysis.scenario.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 分析场景 DTO（对齐前端 analysis.contract.ts AnalysisScenarioDto）
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record AnalysisScenarioDto(
        UUID id,
        UUID problemId,
        String name,
        String description,
        String scenarioType,
        String parameters,
        boolean isBaseline,
        boolean isAiRecommended,
        String aiRecommendationReason,
        String confirmedBy,
        Instant confirmedAt,
        Instant createdAt,
        Instant updatedAt
) {
}
