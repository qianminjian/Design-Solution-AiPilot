package com.platform.core.operations.queue.dto;

import com.platform.core.operations.domain.enums.QueueTaskPriority;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.domain.enums.QueueTaskType;

import java.time.Instant;
import java.util.UUID;

/**
 * 队列任务 DTO（对齐前端 QueueTaskDto 契约）
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
        String dataRegion
) {
}
