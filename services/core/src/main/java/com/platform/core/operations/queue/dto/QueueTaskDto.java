package com.platform.core.operations.queue.dto;

import com.platform.core.operations.domain.enums.QueueTaskPriority;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.domain.enums.QueueTaskType;

import java.time.Instant;
import java.util.UUID;

/**
 * 队列任务 DTO（对齐前端 QueueTaskDto 契约）
 *
 * V1.6 新增字段（Worker Scheduler 自动调度重试 + DeadLetterQueue）：
 *  - nextRetryAt：下次重试时间（RETRY_SCHEDULED 状态）
 *  - retryReason：重试原因
 *  - deadLetteredAt：进入死信队列时间（DEAD_LETTER 状态）
 *  - deadLetterReason：进入死信队列原因
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record QueueTaskDto(
        UUID id,
        QueueTaskType type,
        QueueTaskStatus status,
        QueueTaskPriority priority,
        String payload,
        UUID workerId,
        Instant queuedAt,
        Instant startedAt,
        Integer durationSec,
        int retryCount,
        int maxRetries,
        UUID tenantId,
        String dataRegion,
        // V1.6 新增字段
        Instant nextRetryAt,
        String retryReason,
        Instant deadLetteredAt,
        String deadLetterReason
) {
}
