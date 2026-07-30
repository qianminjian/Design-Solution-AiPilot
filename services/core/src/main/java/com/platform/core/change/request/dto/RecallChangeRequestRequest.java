package com.platform.core.change.request.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 撤回变更请求 DTO
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record RecallChangeRequestRequest(
        @NotBlank @Size(max = 2000) String reason,
        @NotBlank String stepUpToken
) {
}
