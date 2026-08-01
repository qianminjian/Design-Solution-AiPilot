package com.platform.core.governance.qualitygate.domain;

/**
 * 质量门禁等级（D45.23 质量门禁与验收签署，SIT P0-13.4）
 *
 * 6 级 Gate 落实：
 *  - PR_MERGE: static/unit/property/component + 覆盖/质量 + 安全快速扫描（Developer+Reviewer）
 *  - INTEGRATION: contract/integration/migration + 关键 Golden smoke（Component Owner+QA）
 *  - RELEASE_CANDIDATE: 全回归 + 专业金样 + AI TEVV + 安全/性能/可靠性 + 兼容（QA Lead+各域 Owner）
 *  - PREPROD: 生产等价 E2E + 升级/回滚 + restore + canary + 运维演练（Release/SRE/Security）
 *  - PILOT_UAT: 场景脚本 + 用户/专业结论 + 培训支持 + 残余风险（Product/业务/专业 Owner）
 *  - PRODUCTION_PROMOTION: Critical Verification Trace Coverage=100% + 签名 Bundle + Go/No-Go（Release Authority；AI 不代签）
 */
public enum QualityGateLevel {
    /** PR/Merge 门禁 */
    PR_MERGE,
    /** Integration 门禁 */
    INTEGRATION,
    /** Release Candidate 门禁 */
    RELEASE_CANDIDATE,
    /** Preprod 门禁 */
    PREPROD,
    /** Pilot/UAT 门禁 */
    PILOT_UAT,
    /** Production Promotion 门禁（AI 不代签红线） */
    PRODUCTION_PROMOTION,
}
