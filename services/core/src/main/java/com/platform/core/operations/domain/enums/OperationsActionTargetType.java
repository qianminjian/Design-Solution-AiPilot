package com.platform.core.operations.domain.enums;

/**
 * Operations 主动作目标对象类型
 *
 * 与前端 OperationsActionRequest.targetType 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 */
public enum OperationsActionTargetType {
    /** 队列任务（针对 queue_task 执行 RETRY/PAUSE/RESUME/CANCEL） */
    QUEUE_TASK,
    /** Worker（针对 worker 执行 ISOLATE/FAILOVER/PAUSE/RESUME） */
    WORKER,
    /** 连接器（针对 connector 执行 ISOLATE/FAILOVER/RECONCILE） */
    CONNECTOR
}
