package com.platform.core.governance.domain.enums;

/**
 * 治理域风险等级（D37.17 治理中心统一）
 *
 * 与前端 TypeScript GovernanceRiskLevel / BFF zod governanceRiskLevelSchema 对齐。
 * 用于 AccessGrant / Release / AuditLog / DataAsset 等实体的风险标记。
 */
public enum GovernanceRiskLevel {

    /** 低风险：文本摘要、标签生成等 */
    LOW,
    /** 中风险：方案建议、规范检查等 */
    MEDIUM,
    /** 高风险：结构计算、施工图生成等 */
    HIGH,
    /** 极高风险：合规判定、安全评估等 */
    CRITICAL
}
