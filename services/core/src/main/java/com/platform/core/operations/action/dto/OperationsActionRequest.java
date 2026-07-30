package com.platform.core.operations.action.dto;

import com.platform.core.operations.domain.enums.OperationsActionTargetType;
import com.platform.core.operations.domain.enums.OperationsActionType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Operations 主动作请求 DTO（对齐前端 OperationsActionRequest 契约）
 *
 * <p>危险动作约束（D37.17 §危险动作）：
 * <ul>
 *   <li>reason 必填，进入审计日志</li>
 *   <li>stepUpToken：HIGH/IRREVERSIBLE 风险动作必填</li>
 *   <li>impactPreviewAcknowledged：MEDIUM/HIGH/IRREVERSIBLE 必填 true</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record OperationsActionRequest(
        @NotNull OperationsActionType actionType,
        @NotNull OperationsActionTargetType targetType,
        @NotBlank @Size(max = 128) String targetId,
        @NotBlank @Size(max = 2000) String reason,
        @Size(max = 2048) String stepUpToken,
        boolean impactPreviewAcknowledged
) {
}
