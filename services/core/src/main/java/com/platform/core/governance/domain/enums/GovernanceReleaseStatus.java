package com.platform.core.governance.domain.enums;

/**
 * 治理域 Release 状态
 *
 * 用于 Release 实体的状态机管理。
 * 与 BFF zod governanceReleaseStatusSchema 对齐。
 *
 * 状态流转：
 *  DRAFT → REVIEW → CANARY → PROMOTED
 *                ↘ DEPRECATED
 *  PROMOTED → ROLLED_BACK
 */
public enum GovernanceReleaseStatus {

    /** 草稿（编辑中，未提交 review） */
    DRAFT,
    /** 评审中（等待人工 review） */
    REVIEW,
    /** 灰度发布中（部分流量） */
    CANARY,
    /** 已全量发布（promote 完成） */
    PROMOTED,
    /** 已回滚（紧急下线） */
    ROLLED_BACK,
    /** 已弃用（不再推荐使用，但保留历史） */
    DEPRECATED
}
