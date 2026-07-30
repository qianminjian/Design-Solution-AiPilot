package com.platform.core.operations.worker.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.operations.domain.enums.WorkerRuntimeStatus;
import com.platform.core.operations.domain.enums.WorkerType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Worker 运行状态实体（D37.17 运营中心）
 *
 * 字段对齐前端 WorkerStatusDto 契约：
 *  - type/status: Worker 类型与运行状态
 *  - currentTaskId/currentTaskPayload: 当前处理任务
 *  - processedCount/failedCount/avgDurationSec: 处理统计
 *  - cpuPercent/memoryPercent: 资源使用率
 *  - lastHeartbeat: 心跳时间（用于存活检测）
 *  - region/isCustomerSiteWorker: Hybrid-Site 部署标识
 *  - isIsolated: 隔离标记（ISOLATE 动作执行后为 true）
 *
 * 表：operations.worker_status
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D44-部署拓扑-Hybrid-Site.md
 */
@Entity(name = "WorkerStatus")
@Table(name = "worker_status", schema = "operations")
public class WorkerStatus extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** Worker 业务编号（如 "ai-worker-001"） */
    @Column(name = "worker_code", nullable = false, length = 128)
    private String workerCode;

    /** Worker 类型 */
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 16)
    private WorkerType type;

    /** 运行状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private WorkerRuntimeStatus status;

    /** 当前处理任务 ID */
    @Column(name = "current_task_id")
    private UUID currentTaskId;

    /** 当前任务负载描述（PII: L3） */
    @Column(name = "current_task_payload", length = 2000)
    private String currentTaskPayload;

    /** 已处理任务数 */
    @Column(name = "processed_count", nullable = false)
    private long processedCount;

    /** 失败任务数 */
    @Column(name = "failed_count", nullable = false)
    private long failedCount;

    /** 平均处理时长（秒） */
    @Column(name = "avg_duration_sec", nullable = false)
    private int avgDurationSec;

    /** CPU 使用率（百分比） */
    @Column(name = "cpu_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal cpuPercent;

    /** 内存使用率（百分比） */
    @Column(name = "memory_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal memoryPercent;

    /** 最后心跳时间 */
    @Column(name = "last_heartbeat", nullable = false)
    private Instant lastHeartbeat;

    /** Worker 所在 Region（Hybrid-Site 部署） */
    @Column(name = "region", length = 64)
    private String region;

    /** 是否为客户站点 Worker（Hybrid-Site 数据驻留约束） */
    @Column(name = "is_customer_site_worker", nullable = false)
    private boolean customerSiteWorker;

    /** 是否已隔离（ISOLATE 动作执行后为 true，从调度池移除） */
    @Column(name = "is_isolated", nullable = false)
    private boolean isolated;

    /** 隔离原因（审计追溯） */
    @Column(name = "isolated_reason", length = 1000)
    private String isolatedReason;

    /** 隔离时间 */
    @Column(name = "isolated_at")
    private Instant isolatedAt;

    // ── Getters/Setters ──

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getWorkerCode() {
        return workerCode;
    }

    public void setWorkerCode(String workerCode) {
        this.workerCode = workerCode;
    }

    public WorkerType getType() {
        return type;
    }

    public void setType(WorkerType type) {
        this.type = type;
    }

    public WorkerRuntimeStatus getStatus() {
        return status;
    }

    public void setStatus(WorkerRuntimeStatus status) {
        this.status = status;
    }

    public UUID getCurrentTaskId() {
        return currentTaskId;
    }

    public void setCurrentTaskId(UUID currentTaskId) {
        this.currentTaskId = currentTaskId;
    }

    public String getCurrentTaskPayload() {
        return currentTaskPayload;
    }

    public void setCurrentTaskPayload(String currentTaskPayload) {
        this.currentTaskPayload = currentTaskPayload;
    }

    public long getProcessedCount() {
        return processedCount;
    }

    public void setProcessedCount(long processedCount) {
        this.processedCount = processedCount;
    }

    public long getFailedCount() {
        return failedCount;
    }

    public void setFailedCount(long failedCount) {
        this.failedCount = failedCount;
    }

    public int getAvgDurationSec() {
        return avgDurationSec;
    }

    public void setAvgDurationSec(int avgDurationSec) {
        this.avgDurationSec = avgDurationSec;
    }

    public BigDecimal getCpuPercent() {
        return cpuPercent;
    }

    public void setCpuPercent(BigDecimal cpuPercent) {
        this.cpuPercent = cpuPercent;
    }

    public BigDecimal getMemoryPercent() {
        return memoryPercent;
    }

    public void setMemoryPercent(BigDecimal memoryPercent) {
        this.memoryPercent = memoryPercent;
    }

    public Instant getLastHeartbeat() {
        return lastHeartbeat;
    }

    public void setLastHeartbeat(Instant lastHeartbeat) {
        this.lastHeartbeat = lastHeartbeat;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public boolean isCustomerSiteWorker() {
        return customerSiteWorker;
    }

    public void setCustomerSiteWorker(boolean customerSiteWorker) {
        this.customerSiteWorker = customerSiteWorker;
    }

    public boolean isIsolated() {
        return isolated;
    }

    public void setIsolated(boolean isolated) {
        this.isolated = isolated;
    }

    public String getIsolatedReason() {
        return isolatedReason;
    }

    public void setIsolatedReason(String isolatedReason) {
        this.isolatedReason = isolatedReason;
    }

    public Instant getIsolatedAt() {
        return isolatedAt;
    }

    public void setIsolatedAt(Instant isolatedAt) {
        this.isolatedAt = isolatedAt;
    }
}
