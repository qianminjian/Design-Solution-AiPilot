package com.platform.core.governance.domain.enums;

/**
 * 治理域数据资产类型
 *
 * 与 BFF zod governanceDataAssetTypeSchema 对齐。
 */
public enum GovernanceDataAssetType {

    /** 数据字典（枚举值、配置项） */
    DICTIONARY,
    /** 数据集（训练/测试/验证集） */
    DATASET,
    /** AI 模型（已训练模型文件） */
    MODEL,
    /** 发布物（施工图、设计文档、报告） */
    PUBLICATION,
    /** 证据（审计证据、合规证据） */
    EVIDENCE
}
