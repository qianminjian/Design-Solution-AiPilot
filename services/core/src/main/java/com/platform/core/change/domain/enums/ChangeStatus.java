package com.platform.core.change.domain.enums;

/**
 * 变更请求状态
 *
 * 状态机流转：
 * DRAFT → SUBMITTED → IMPACT_ASSESSMENT → PENDING_APPROVAL
 *      → APPROVED → IN_PROGRESS → PENDING_VERIFICATION → CLOSED
 *      ↓ (任意阶段) → REJECTED / RECALLED
 *
 * 与前端 ChangeStatus 契约对齐（@design/D37-关键界面-交互状态.md §D37.16）。
 */
public enum ChangeStatus {
    /** 草稿（可编辑/删除） */
    DRAFT,
    /** 已提交，进入影响评估阶段 */
    SUBMITTED,
    /** 影响评估中 */
    IMPACT_ASSESSMENT,
    /** 待批准（影响评估完成，待批准人决策） */
    PENDING_APPROVAL,
    /** 已批准，进入实施阶段 */
    APPROVED,
    /** 实施中 */
    IN_PROGRESS,
    /** 待验证关闭 */
    PENDING_VERIFICATION,
    /** 已关闭（终态） */
    CLOSED,
    /** 已拒绝（终态） */
    REJECTED,
    /** 已撤回（终态） */
    RECALLED
}
