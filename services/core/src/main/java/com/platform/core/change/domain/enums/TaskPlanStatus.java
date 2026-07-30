package com.platform.core.change.domain.enums;

/**
 * 处置任务状态
 *
 * 与前端 TaskPlanStatus 契约对齐（@design/D37-关键界面-交互状态.md §D37.16）。
 * 关闭前所有任务必须完成。
 */
public enum TaskPlanStatus {
    /** 待启动 */
    PENDING,
    /** 进行中 */
    IN_PROGRESS,
    /** 已完成 */
    COMPLETED,
    /** 已跳过（带审批记录） */
    SKIPPED,
    /** 已阻塞 */
    BLOCKED,
    /** 已取消 */
    CANCELLED
}
