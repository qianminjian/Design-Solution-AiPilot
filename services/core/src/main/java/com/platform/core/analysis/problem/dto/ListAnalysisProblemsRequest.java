package com.platform.core.analysis.problem.dto;

import com.platform.core.analysis.domain.enums.AnalysisProblemType;
import com.platform.core.analysis.domain.enums.ProblemStatus;

/**
 * 工程分析问题列表查询参数
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record ListAnalysisProblemsRequest(
        String projectId,
        String keyword,
        ProblemStatus status,
        AnalysisProblemType type,
        Integer page,
        Integer pageSize
) {
}
