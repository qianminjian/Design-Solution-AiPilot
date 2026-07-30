package com.platform.core.operations.domain.enums;

/**
 * Operations 主动作风险等级（D37.23 §危险动作）
 *
 * 与前端 OPERATIONS_ACTION_RISK_LEVEL 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 *
 * 用于危险动作约束判定：
 *  - LOW: 无需额外校验
 *  - MEDIUM: 需 impactPreviewAcknowledged=true
 *  - HIGH: 需 stepUpToken + impactPreviewAcknowledged=true
 *  - IRREVERSIBLE: 需 stepUpToken + impactPreviewAcknowledged=true + 双人审批
 */
public enum OperationsRiskLevel {
    /** 低风险（无需额外校验，如 RESUME） */
    LOW,
    /** 中风险（需影响预览确认，如 RETRY/RECONCILE/PAUSE） */
    MEDIUM,
    /** 高风险（需 stepUpToken + 影响预览确认，如 ISOLATE/FAILOVER） */
    HIGH,
    /** 不可逆（需 stepUpToken + 影响预览确认 + 双人审批，如 CANCEL） */
    IRREVERSIBLE
}
