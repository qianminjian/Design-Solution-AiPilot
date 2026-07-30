package com.platform.core.operations.domain.enums;

/**
 * 队列任务优先级
 *
 * 与前端 QueueTaskPriority 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 */
public enum QueueTaskPriority {
    /** 低（清理任务、批量导入等） */
    LOW,
    /** 中（默认优先级） */
    NORMAL,
    /** 高（用户主动触发的任务） */
    HIGH,
    /** 关键（阻断流程的紧急任务，如门禁阻断修复） */
    CRITICAL
}
