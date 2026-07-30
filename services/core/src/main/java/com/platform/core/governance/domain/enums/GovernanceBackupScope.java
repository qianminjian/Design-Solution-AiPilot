package com.platform.core.governance.domain.enums;

/**
 * 治理域备份范围
 *
 * 与 BFF zod governanceBackupScopeSchema 对齐。
 */
public enum GovernanceBackupScope {

    /** 仅数据库 */
    DATABASE,
    /** 仅对象存储 */
    OBJECT_STORAGE,
    /** 仅配置 */
    CONFIG,
    /** 全部 */
    ALL
}
