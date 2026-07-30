package com.platform.core.operations.queue.dto;

import com.platform.core.operations.domain.enums.QueueTaskPriority;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.domain.enums.QueueTaskType;

import java.util.UUID;

/**
 * 列出队列任务请求（对齐前端 ListQueueTasksRequest 契约）
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record ListQueueTasksRequest(
        QueueTaskStatus status,
        QueueTaskType type,
        QueueTaskPriority priority,
        UUID workerId,
        String keyword,
        Integer page,
        Integer pageSize
) {
}
