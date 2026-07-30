package com.platform.core.governance.domain.enums;

/**
 * 治理域 Release 红队测试结果状态
 *
 * 用于 AI/规则 Release 的对抗性测试结果标记。
 * 与 BFF zod governanceRedteamStatusSchema 对齐。
 */
public enum GovernanceRedteamStatus {

    /** 红队测试通过 */
    PASS,
    /** 红队测试发现低危问题，可放行但需跟进 */
    WARNING,
    /** 红队测试发现高危问题，禁止发布 */
    FAIL,
    /** 待执行红队测试 */
    PENDING
}
