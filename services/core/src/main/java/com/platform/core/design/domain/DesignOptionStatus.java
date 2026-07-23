package com.platform.core.design.domain;

/**
 * 设计选项状态枚举
 *
 * 状态机：draft → candidate → submitted → (accepted | returned) → archived
 */
public enum DesignOptionStatus {
    /** 草稿 */
    DRAFT,
    /** 候选（已完成内部评审） */
    CANDIDATE,
    /** 已提交（待客户/评审方决策） */
    SUBMITTED,
    /** 已采纳 */
    ACCEPTED,
    /** 已退回（需修改） */
    RETURNED,
    /** 已归档 */
    ARCHIVED
}
