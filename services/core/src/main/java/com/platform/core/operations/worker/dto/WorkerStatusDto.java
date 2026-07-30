package com.platform.core.operations.worker.dto;

import com.platform.core.operations.domain.enums.WorkerRuntimeStatus;
import com.platform.core.operations.domain.enums.WorkerType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Worker 运行状态 DTO（对齐前端 WorkerStatusDto 契约）
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record WorkerStatusDto(
        UUID id,
        WorkerType type,
        WorkerRuntimeStatus status,
        UUID currentTaskId,
        String currentTaskPayload,
        long processedCount,
        long failedCount,
        int avgDurationSec,
        BigDecimal cpuPercent,
        BigDecimal memoryPercent,
        Instant lastHeartbeat,
        String region,
        boolean isCustomerSiteWorker
) {
}
