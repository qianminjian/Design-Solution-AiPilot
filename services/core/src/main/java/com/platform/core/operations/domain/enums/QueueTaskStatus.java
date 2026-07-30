package com.platform.core.operations.domain.enums;

/**
 * 队列任务状态
 *
 * 状态机流转：
 * QUEUED → RUNNING → COMPLETED
 *      ↓ (任意阶段) → PAUSED → RESUME → QUEUED/RUNNING
 *                  → FAILED → RETRY → QUEUED
 *                  → CANCELLED（终态）
 *
 * 与前端 QueueTaskStatus 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 */
public enum QueueTaskStatus {
    /** 排队中（等待 Worker 拉取） */
    QUEUED,
    /** 运行中（Worker 正在处理） */
    RUNNING,
    /** 已暂停（人工暂停或依赖阻塞） */
    PAUSED,
    /** 失败（达到最大重试次数或不可恢复错误） */
    FAILED,
    /** 已完成（终态） */
    COMPLETED
}
