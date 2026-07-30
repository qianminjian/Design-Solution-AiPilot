package com.platform.core.operations.worker.dto;

import com.platform.core.operations.domain.enums.WorkerRuntimeStatus;
import com.platform.core.operations.domain.enums.WorkerType;

/**
 * 列出 Worker 请求（对齐前端 ListWorkersRequest 契约）
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record ListWorkersRequest(
        WorkerType type,
        WorkerRuntimeStatus status,
        String region,
        String keyword
) {
}
