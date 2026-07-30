package com.platform.core.analysis.problem.dto;

import com.platform.core.analysis.domain.enums.AnalysisProblemType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 创建工程分析问题 DTO
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record CreateAnalysisProblemRequest(
        @NotBlank @Size(max = 500) String title,
        @Size(max = 4000) String description,
        @NotNull AnalysisProblemType type,
        @NotBlank @Size(max = 64) String projectId,
        @Size(max = 200) String projectName,
        @Size(max = 64) String baselineId,
        @Size(max = 128) String baselineHash,
        @NotBlank @Size(max = 200) String owner,
        @NotBlank @Size(max = 100) String ownerRole,
        Integer inputCompleteness,
        Integer assumptionCount,
        Integer boundaryConditionCount,
        Integer loadCaseCount
) {
}
