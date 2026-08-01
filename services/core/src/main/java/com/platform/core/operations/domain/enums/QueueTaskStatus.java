package com.platform.core.operations.domain.enums;

/**
 * 队列任务状态
 *
 * 状态机流转：
 * QUEUED → RUNNING → COMPLETED
 *      ↓ (任意阶段) → PAUSED → RESUME → QUEUED/RUNNING
 *                  → FAILED → RETRY → QUEUED（手动重试）
 *                  → RETRY_SCHEDULED → QUEUED（WorkerScheduler 自动调度）
 *                  → DEAD_LETTER（达到 maxRetries 进入死信队列）
 *                  → CANCELLED（终态）
 *
 * 与前端 QueueTaskStatus 契约对齐（@design/D37-关键界面-交互状态.md §D37.17）。
 *
 * V1.6 新增（Sprint V1.6 Worker Scheduler 自动调度重试 + DeadLetterQueue）：
 *  - RETRY_SCHEDULED：重试已调度（等待指数退避时间到达后由 WorkerScheduler 重置为 QUEUED）
 *  - DEAD_LETTER：死信（达到 maxRetries 阈值后转入，需人工 replay 或删除）
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
    COMPLETED,
    /**
     * 重试已调度（V1.6 新增）
     * failTask 检测 retryCount < maxRetries 时切换到此状态，
     * 由 WorkerScheduler 定时扫描 nextRetryAt 到期后重置为 QUEUED。
     */
    RETRY_SCHEDULED,
    /**
     * 死信（V1.6 新增，终态）
     * failTask 检测 retryCount >= maxRetries 时切换到此状态，
     * 需人工通过 DeadLetterTask API replay 重新入队或删除。
     */
    DEAD_LETTER
}
