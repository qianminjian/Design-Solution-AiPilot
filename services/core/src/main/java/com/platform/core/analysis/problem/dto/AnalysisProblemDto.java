package com.platform.core.analysis.problem.dto;

import com.platform.core.analysis.domain.enums.AnalysisProblemType;
import com.platform.core.analysis.domain.enums.ProblemStatus;
import com.platform.core.analysis.domain.enums.ResultQualityStatus;
import com.platform.core.analysis.domain.enums.RunStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * 工程分析问题 DTO（对齐前端 analysis.contract.ts AnalysisProblemDto）
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record AnalysisProblemDto(
        UUID id,
        String code,
        String title,
        AnalysisProblemType type,
        ProblemStatus status,
        String description,
        String projectId,
        String projectName,
        String baselineId,
        String baselineHash,
        String owner,
        String ownerRole,
        int inputCompleteness,
        int assumptionCount,
        int boundaryConditionCount,
        int loadCaseCount,
        int runCount,
        UUID latestRunId,
        RunStatus latestRunStatus,
        ResultQualityStatus latestResultQuality,
        boolean requiresHumanReview,
        boolean isAiAssisted,
        Instant submittedAt,
        Instant invalidatedAt,
        String invalidationReason,
        Instant createdAt,
        Instant updatedAt
) {
}
