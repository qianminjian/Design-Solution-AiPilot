package com.platform.core.governance.domain.enums;

/**
 * 治理域数据资产状态
 *
 * 与 BFF zod governanceDataAssetStatusSchema 对齐。
 */
public enum GovernanceDataAssetStatus {

    /** 活跃中（正常使用） */
    ACTIVE,
    /** 已归档（不再使用，但保留） */
    ARCHIVED,
    /** 待删除（在保留期外，等待最终删除） */
    DELETION_PENDING,
    /** 法律保留冲突（处于法律保留状态，禁止任何变更） */
    HOLD_CONFLICT
}
