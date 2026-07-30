package com.platform.core.change.request.dto;

import com.platform.core.change.domain.enums.ChangePriority;
import com.platform.core.change.domain.enums.ChangeType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 创建变更请求 DTO
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record CreateChangeRequestRequest(
        @NotBlank @Size(max = 500) String title,
        @Size(max = 4000) String description,
        @NotNull ChangeType type,
        @NotNull ChangePriority priority,
        @NotBlank @Size(max = 64) String projectId,
        @Size(max = 64) String baselineId,
        @Size(max = 2000) String riskAssessment
) {
}
