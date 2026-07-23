package com.platform.core.portfolio.domain;

/**
 * 基线修订状态枚举
 * 对应 PostgreSQL revision_status 类型，见 V1__init_iam.sql §3
 * 与 portfolio.contract.ts RevisionStatus 保持一致（DB 大写）
 *
 * <p>语义说明：DB 中的 PUBLISHED 状态对应契约中的 "frozen"（已冻结/已发布），
 * 即基线不可变、可被门禁决策引用。</p>
 */
public enum RevisionStatus {

    /** 草稿（可编辑） */
    DRAFT,
    /** 已发布/已冻结（不可变，可被门禁引用） */
    PUBLISHED,
    /** 已被新版本取代 */
    SUPERSEDED
}
