package com.platform.core.governance.domain.enums;

/**
 * 治理域证据包状态
 *
 * 与 BFF zod governanceEvidencePackageStatusSchema 对齐。
 *
 * 状态流转：
 *  DRAFT → SEALED (管理员签章)
 *  SEALED → VERIFIED (验证方校验通过)
 *  SEALED / VERIFIED → CHALLENGED (被质疑，触发复核)
 */
public enum GovernanceEvidencePackageStatus {

    /** 草稿（编辑中，可添加/移除证据项） */
    DRAFT,
    /** 已封存（不可再修改，需签章） */
    SEALED,
    /** 已验证（第三方或验证方校验通过） */
    VERIFIED,
    /** 被质疑（合规质疑，触发复核） */
    CHALLENGED
}
