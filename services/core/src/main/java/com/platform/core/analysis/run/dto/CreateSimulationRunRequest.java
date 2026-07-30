package com.platform.core.analysis.run.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * 创建模拟运行 DTO
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record CreateSimulationRunRequest(
        @NotNull UUID problemId,
        @NotNull UUID scenarioId,
        @NotNull UUID solverProfileId,
        @Size(max = 64) String solverVersion
) {
}
