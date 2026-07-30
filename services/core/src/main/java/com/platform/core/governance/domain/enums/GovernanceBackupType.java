package com.platform.core.governance.domain.enums;

/**
 * 治理域备份类型
 *
 * 与 BFF zod governanceBackupTypeSchema 对齐。
 */
public enum GovernanceBackupType {

    /** 全量备份 */
    FULL,
    /** 增量备份 */
    INCREMENTAL,
    /** WAL 日志备份（PostgreSQL 预写日志） */
    WAL
}
