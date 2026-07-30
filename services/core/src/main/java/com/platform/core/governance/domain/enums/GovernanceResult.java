package com.platform.core.governance.domain.enums;

/**
 * 治理域操作结果状态
 *
 * 用于审计日志记录的操作结果（success/failure/denied/error）。
 * 与 BFF zod governanceResultSchema 对齐。
 */
public enum GovernanceResult {

    /** 操作成功 */
    SUCCESS,
    /** 操作失败（系统或业务异常） */
    FAILURE,
    /** 操作被拒绝（权限或策略拦截） */
    DENIED,
    /** 操作错误（不可恢复异常） */
    ERROR
}
