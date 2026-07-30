package com.platform.core.governance.domain.enums;

/**
 * 治理域备份状态
 *
 * 与 BFF zod governanceBackupStatusSchema 对齐。
 *
 * 状态流转：
 *  RUNNING → COMPLETED (成功)
 *  RUNNING → FAILED (失败)
 *  COMPLETED → VERIFYING (启动校验)
 *  VERIFYING → VERIFIED (校验通过)
 *  VERIFYING → FAILED (校验失败)
 */
public enum GovernanceBackupStatus {

    /** 进行中 */
    RUNNING,
    /** 已完成 */
    COMPLETED,
    /** 失败 */
    FAILED,
    /** 校验中 */
    VERIFYING,
    /** 已校验 */
    VERIFIED
}
