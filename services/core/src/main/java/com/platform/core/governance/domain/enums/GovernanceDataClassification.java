package com.platform.core.governance.domain.enums;

/**
 * 治理域数据分类等级
 *
 * 对齐 security.md §8 PII 分级 L1-L5，用于 DataAsset 等实体的数据敏感度标记。
 * 与 BFF zod governanceDataClassificationSchema 对齐。
 *
 * 注意：与 iam.domain.DataClassification 不同，治理域使用 L1-L5 分级体系，
 * 而 iam 域使用 WORKING/PUBLISHED_EVIDENCE 等业务分类。
 */
public enum GovernanceDataClassification {

    /** 直接识别信息：姓名、手机号、身份证号、邮箱 */
    L1,
    /** 间接识别信息：部门、岗位、工号 */
    L2,
    /** 敏感业务数据：项目预算、合同金额 */
    L3,
    /** 专业设计成果：方案图纸、BIM 模型 */
    L4,
    /** 业务核心设计文件：施工图终版、审批签章文件 */
    L5
}
