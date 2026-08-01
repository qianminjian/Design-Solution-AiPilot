package com.platform.core.governance.testevidence.domain;

/**
 * 测试证据保留策略（D45.10 TestEvidence.retention）
 *
 * 对齐 security.md §9 数据生命周期留存期：
 *  - project_lifetime：项目生命周期
 *  - legal_hold：法律保留（L5 核心证据，D41 WORM 封存）
 */
public enum TestEvidenceRetention {
    /** 项目生命周期 */
    PROJECT_LIFETIME,
    /** 法律保留（WORM 封存） */
    LEGAL_HOLD,
    /** 30 天 */
    DAYS_30,
    /** 90 天 */
    DAYS_90,
    /** 1 年 */
    YEAR_1,
}
