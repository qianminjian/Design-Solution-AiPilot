package com.platform.core.governance.testexception.domain;

/**
 * 测试例外状态（D45.22 例外治理 / D45.25 TestException API）
 *
 * 状态机：
 *  - PENDING_REVIEW 待审批签署
 *  - ACTIVE 已签署生效（Conditional Pass 例外）
 *  - EXPIRED 到期自动撤销（Conditional Pass 到期自动撤销验收）
 *  - REVOKED 手动撤销（POST /test-exceptions/{id}:revoke）
 *  - CLOSED 关闭（复测通过或版本升级不继承）
 */
public enum TestExceptionStatus {
    /** 待审批签署 */
    PENDING_REVIEW,
    /** 已签署生效（Conditional Pass 例外） */
    ACTIVE,
    /** 到期自动撤销 */
    EXPIRED,
    /** 手动撤销 */
    REVOKED,
    /** 关闭 */
    CLOSED,
}
