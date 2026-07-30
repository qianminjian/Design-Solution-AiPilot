package com.platform.core.governance.domain.enums;

/**
 * 治理域访问授权状态
 *
 * 用于 AccessGrant 实体的状态机管理。
 * 与 BFF zod governanceAccessGrantStatusSchema 对齐。
 */
public enum GovernanceAccessGrantStatus {

    /** 已生效，处于有效期内 */
    ACTIVE,
    /** 待复核（高风险授权创建后需人工 review） */
    PENDING_REVIEW,
    /** 已缩短（复核后缩短了有效期） */
    SHORTENED,
    /** 已撤销（管理员或安全团队主动撤销） */
    REVOKED,
    /** 已过期（自动到期，未续期） */
    EXPIRED
}
