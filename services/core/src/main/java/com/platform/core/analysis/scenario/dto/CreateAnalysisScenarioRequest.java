package com.platform.core.analysis.scenario.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 创建分析场景 DTO
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record CreateAnalysisScenarioRequest(
        @NotBlank @Size(max = 500) String name,
        @Size(max = 2000) String description,
        @NotBlank @Size(max = 32) String scenarioType,
        String parameters,
        boolean isBaseline,
        boolean isAiRecommended,
        @Size(max = 2000) String aiRecommendationReason
) {
}
