package com.platform.core.change.domain.enums;

/**
 * 操作阶段执行状态
 *
 * 与前端 ChangeOperationPhaseStatus 契约对齐（@design/D37-关键界面-交互状态.md §D37.16）。
 */
public enum ChangeOperationPhaseStatus {
    /** 已完成 */
    COMPLETED,
    /** 进行中 */
    IN_PROGRESS,
    /** 失败 */
    FAILED,
    /** 已跳过 */
    SKIPPED
}
