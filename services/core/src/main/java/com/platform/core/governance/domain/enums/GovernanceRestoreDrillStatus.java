package com.platform.core.governance.domain.enums;

/**
 * 治理域灾备演练状态
 *
 * 与 BFF zod governanceRestoreDrillStatusSchema 对齐。
 */
public enum GovernanceRestoreDrillStatus {

    /** 已排期 */
    SCHEDULED,
    /** 进行中 */
    RUNNING,
    /** 已完成 */
    COMPLETED,
    /** 失败 */
    FAILED,
    /** 已取消 */
    CANCELLED
}
