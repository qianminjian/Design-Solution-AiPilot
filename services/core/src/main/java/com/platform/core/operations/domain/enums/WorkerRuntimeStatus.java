package com.platform.core.operations.domain.enums;

/**
 * Worker 运行状态
 *
 * 与前端 WorkerRuntimeStatus 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 */
public enum WorkerRuntimeStatus {
    /** 运行中（正在处理任务） */
    RUNNING,
    /** 空闲（在线但无任务） */
    IDLE,
    /** 已停止（人工停止或维护中） */
    STOPPED,
    /** 异常（心跳超时或错误率超阈值） */
    ERROR
}
