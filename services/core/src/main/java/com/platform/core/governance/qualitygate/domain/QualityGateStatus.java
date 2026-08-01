package com.platform.core.governance.qualitygate.domain;

/**
 * 质量门禁状态（D45.23）
 *
 *  - NOT_STARTED 未开始
 *  - IN_PROGRESS 进行中
 *  - PASSED 已通过（签署 PASS）
 *  - FAILED 已失败（签署 FAIL 或检查未通过）
 *  - BLOCKED 被阻断（Critical/High 缺陷未关闭、覆盖率缺口）
 */
public enum QualityGateStatus {
    /** 未开始 */
    NOT_STARTED,
    /** 进行中 */
    IN_PROGRESS,
    /** 已通过 */
    PASSED,
    /** 已失败 */
    FAILED,
    /** 被阻断 */
    BLOCKED,
}
