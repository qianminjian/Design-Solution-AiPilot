package com.platform.core.governance.domain.enums;

/**
 * 治理域 Release 监控指标漂移程度
 *
 * 用于灰度发布后监控指标对比，决定是否升级或回滚。
 * 与 BFF zod governanceMetricsDriftSchema 对齐。
 */
public enum GovernanceMetricsDrift {

    /** 无漂移（指标稳定） */
    NONE,
    /** 轻微漂移（可接受范围内，需关注） */
    MINOR,
    /** 重大漂移（超出阈值，需回滚或降级） */
    MAJOR
}
