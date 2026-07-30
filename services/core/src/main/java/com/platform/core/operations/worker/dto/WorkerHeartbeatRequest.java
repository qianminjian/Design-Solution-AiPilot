package com.platform.core.operations.worker.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Worker 心跳上报 DTO
 *
 * <p>Worker 周期性调用 POST /api/v1/operations/workers/{id}/heartbeat 上报心跳，
 * 包含当前任务、资源占用等运行时信息。
 *
 * <p>心跳超时判定：超过 90s 未上报视为 stale，调度器将其移出调度池。
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
public record WorkerHeartbeatRequest(
        /** Worker 实例 ID（注册时返回的 id） */
        @NotNull
        UUID id,

        /** 当前处理任务 ID（无任务时为 null） */
        UUID currentTaskId,

        /** 当前任务负载描述（PII: L3，脱敏后存储） */
        @Size(max = 2000)
        String currentTaskPayload,

        /** 已处理任务数（累计） */
        long processedCount,

        /** 失败任务数（累计） */
        long failedCount,

        /** 平均处理时长（秒） */
        int avgDurationSec,

        /** CPU 使用率（百分比） */
        BigDecimal cpuPercent,

        /** 内存使用率（百分比） */
        BigDecimal memoryPercent
) {
}
