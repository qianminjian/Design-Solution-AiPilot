package com.platform.core.operations.action.dto;

import com.platform.core.operations.domain.enums.DualApprovalStatus;
import com.platform.core.operations.domain.enums.OperationsActionStatus;
import com.platform.core.operations.domain.enums.OperationsActionType;
import com.platform.core.operations.domain.enums.OperationsRiskLevel;

import java.time.Instant;

/**
 * Operations 主动作响应 DTO（对齐前端 OperationsActionResponseDto 契约）
 *
 * <p>V1.9 扩展：新增双人审批相关字段（dualApprovalStatus/reviewer1Id/reviewer2Id 等），
 * 前端可据此渲染审批进度条与待办状态。
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record OperationsActionResponseDto(
        String operationId,
        OperationsActionType actionType,
        String targetId,
        OperationsActionStatus status,
        OperationsRiskLevel riskLevel,
        String initiatedBy,
        Instant initiatedAt,
        Instant completedAt,
        int affectedCount,
        String auditTraceId,
        String errorMessage,
        // V1.9 双人审批字段
        DualApprovalStatus dualApprovalStatus,
        String reviewer1Id,
        Instant reviewer1At,
        String reviewer2Id,
        Instant reviewer2At
) {
}
