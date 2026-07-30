package com.platform.core.analysis.domain.enums;

/**
 * 模拟运行状态（D37.14 P10 工程分析运行与结果质量）
 *
 * 状态机：
 * QUEUED → LICENSING → PREPARING → RUNNING → POST_PROCESSING → CONVERGED / DIVERGED
 *                                                                ↓
 *                                                              CANCELLED / FAILED
 * UNKNOWN：需 Reconcile（D37.17 retry storm 防护）
 *
 * 对应 @design/D37-关键界面-交互状态.md §D37.14。
 */
public enum RunStatus {
    /** 排队中 */
    QUEUED,
    /** 等待许可证 */
    LICENSING,
    /** 准备环境 */
    PREPARING,
    /** 运行中 */
    RUNNING,
    /** 后处理 */
    POST_PROCESSING,
    /** 已收敛 */
    CONVERGED,
    /** 已发散 */
    DIVERGED,
    /** 已取消 */
    CANCELLED,
    /** 失败 */
    FAILED,
    /** 未知（需 Reconcile） */
    UNKNOWN
}
