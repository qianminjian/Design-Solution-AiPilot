package com.platform.core.operations.domain.enums;

/**
 * 双人审批状态枚举（V1.9 IRREVERSIBLE 动作）
 *
 * <p>状态机流转：
 * <ul>
 *   <li>NOT_REQUIRED：非 IRREVERSIBLE 动作默认值（LOW/MEDIUM/HIGH 直接执行）</li>
 *   <li>PENDING_REVIEW1：IRREVERSIBLE 已发起，待审批人 1 批准</li>
 *   <li>REJECTED_REVIEW1：审批人 1 拒绝（终态）</li>
 *   <li>PENDING_REVIEW2：审批人 1 已批准，待审批人 2 批准</li>
 *   <li>APPROVED：审批人 2 已批准，动作已执行完成（终态）</li>
 *   <li>REJECTED_REVIEW2：审批人 2 拒绝（终态）</li>
 * </ul>
 *
 * <p>安全红线（D37.23 §不可逆/合规）：
 * <ul>
 *   <li>IRREVERSIBLE 动作必须完成双人审批才能执行实际业务逻辑</li>
 *   <li>审批人 1 ≠ 发起人（initiated_by）</li>
 *   <li>审批人 2 ≠ 审批人 1 ≠ 发起人（三人不同）</li>
 *   <li>审批人 1/2 必须提供 stepUpToken 二次认证</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.23（不可逆/合规：二人审批）
 * @design D37-关键界面-交互状态.md §D37.17（Operations 中心 §危险动作）
 */
public enum DualApprovalStatus {
    /** 非 IRREVERSIBLE 动作默认值（LOW/MEDIUM/HIGH 直接执行，不进入双人审批流程） */
    NOT_REQUIRED,

    /** IRREVERSIBLE 动作已发起，等待审批人 1 批准（不执行实际业务动作） */
    PENDING_REVIEW1,

    /** 审批人 1 拒绝（终态，动作不执行） */
    REJECTED_REVIEW1,

    /** 审批人 1 已批准，等待审批人 2 批准 */
    PENDING_REVIEW2,

    /** 审批人 2 已批准，动作已执行完成（终态） */
    APPROVED,

    /** 审批人 2 拒绝（终态，动作不执行） */
    REJECTED_REVIEW2;

    /** 判断是否为终态（不可再变更） */
    public boolean isTerminal() {
        return this == REJECTED_REVIEW1 || this == APPROVED || this == REJECTED_REVIEW2;
    }

    /** 判断是否已通过审批（可用于执行实际动作的前置校验） */
    public boolean isApproved() {
        return this == APPROVED;
    }

    /** 判断是否处于审批中（等待审批人操作） */
    public boolean isPending() {
        return this == PENDING_REVIEW1 || this == PENDING_REVIEW2;
    }
}
