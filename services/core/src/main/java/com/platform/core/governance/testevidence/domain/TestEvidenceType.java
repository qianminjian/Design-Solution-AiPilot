package com.platform.core.governance.testevidence.domain;

/**
 * 测试证据类型（D45.10 TestEvidence.type）
 *
 * 对齐 SIT 测试板块分类：单元/集成/E2E/性能/安全/验收/契约
 */
public enum TestEvidenceType {
    /** 单元测试证据 */
    UNIT,
    /** 集成测试证据 */
    INTEGRATION,
    /** E2E 测试证据 */
    E2E,
    /** 性能测试证据 */
    PERFORMANCE,
    /** 安全测试证据 */
    SECURITY,
    /** 验收测试证据（Acceptance） */
    ACCEPTANCE,
    /** 契约测试证据（Contract/Pact） */
    CONTRACT,
}
