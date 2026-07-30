package com.platform.core.operations.worker.dto;

import com.platform.core.operations.domain.enums.WorkerType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Worker 注册请求 DTO
 *
 * <p>Worker 启动时调用 POST /api/v1/operations/workers/register 注册自身。
 * 同一 workerCode 已存在时更新记录（幂等注册）。
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D44-部署拓扑-Hybrid-Site.md
 */
public record WorkerRegisterRequest(
        /** Worker 业务编号（如 "ai-worker-001"） */
        @NotBlank
        @Size(max = 128)
        String workerCode,

        /** Worker 类型 */
        @NotNull
        WorkerType type,

        /** 部署 Region（Hybrid-Site 部署标识） */
        @Size(max = 64)
        String region,

        /** 是否客户站点 Worker（数据驻留约束） */
        boolean isCustomerSiteWorker,

        /** 初始 CPU 使用率（百分比，可选） */
        BigDecimal cpuPercent,

        /** 初始内存使用率（百分比，可选） */
        BigDecimal memoryPercent
) {
}
