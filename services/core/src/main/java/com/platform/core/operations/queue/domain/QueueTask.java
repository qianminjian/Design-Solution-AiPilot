package com.platform.core.operations.queue.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.operations.domain.enums.QueueTaskPriority;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.domain.enums.QueueTaskType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * 队列任务实体（D37.17 运营中心）
 *
 * 状态机：
 * QUEUED → RUNNING → COMPLETED
 *      ↓ (任意阶段) → PAUSED → RESUME → QUEUED/RUNNING
 *                  → FAILED → RETRY → QUEUED
 *                  → CANCELLED（终态）
 *
 * 安全红线：
 *  - retry storm 检测：retry_count > max_retries * 2 时触发告警
 *  - unknown job：通过 status 字段显式标识，不并入 queued/running
 *  - 跨 Region 数据传输：data_region 字段记录数据驻留约束
 *
 * 表：operations.queue_task
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@Entity(name = "QueueTask")
@Table(name = "queue_task", schema = "operations")
public class QueueTask extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 任务类型 */
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private QueueTaskType type;

    /** 任务状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private QueueTaskStatus status;

    /** 优先级 */
    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 16)
    private QueueTaskPriority priority;

    /** 任务负载描述（项目/阶段/资源摘要，PII: L3） */
    @Column(name = "payload", nullable = false, length = 2000)
    private String payload;

    /** 处理该任务的 Worker ID */
    @Column(name = "worker_id")
    private UUID workerId;

    /** 排队时间 */
    @Column(name = "queued_at", nullable = false)
    private Instant queuedAt;

    /** 开始处理时间 */
    @Column(name = "started_at")
    private Instant startedAt;

    /** 完成时间 */
    @Column(name = "completed_at")
    private Instant completedAt;

    /** 已耗时（秒） */
    @Column(name = "duration_sec")
    private Integer durationSec;

    /** 已重试次数 */
    @Column(name = "retry_count", nullable = false)
    private int retryCount;

    /** 最大重试次数（默认 3，retry storm 检测阈值） */
    @Column(name = "max_retries", nullable = false)
    private int maxRetries = 3;

    /** 数据驻留 Region（Hybrid-Site 跨境数据传输约束） */
    @Column(name = "data_region", length = 64)
    private String dataRegion;

    /** 最近错误信息 */
    @Column(name = "last_error", length = 2000)
    private String lastError;

    /** 关联项目 ID */
    @Column(name = "project_id", length = 64)
    private String projectId;

    /** 关联阶段 ID */
    @Column(name = "stage_id", length = 64)
    private String stageId;

    // ── Getters/Setters ──

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public QueueTaskType getType() {
        return type;
    }

    public void setType(QueueTaskType type) {
        this.type = type;
    }

    public QueueTaskStatus getStatus() {
        return status;
    }

    public void setStatus(QueueTaskStatus status) {
        this.status = status;
    }

    public QueueTaskPriority getPriority() {
        return priority;
    }

    public void setPriority(QueueTaskPriority priority) {
        this.priority = priority;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public UUID getWorkerId() {
        return workerId;
    }

    public void setWorkerId(UUID workerId) {
        this.workerId = workerId;
    }

    public Instant getQueuedAt() {
        return queuedAt;
    }

    public void setQueuedAt(Instant queuedAt) {
        this.queuedAt = queuedAt;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public Integer getDurationSec() {
        return durationSec;
    }

    public void setDurationSec(Integer durationSec) {
        this.durationSec = durationSec;
    }

    public int getRetryCount() {
        return retryCount;
    }

    public void setRetryCount(int retryCount) {
        this.retryCount = retryCount;
    }

    public int getMaxRetries() {
        return maxRetries;
    }

    public void setMaxRetries(int maxRetries) {
        this.maxRetries = maxRetries;
    }

    public String getDataRegion() {
        return dataRegion;
    }

    public void setDataRegion(String dataRegion) {
        this.dataRegion = dataRegion;
    }

    public String getLastError() {
        return lastError;
    }

    public void setLastError(String lastError) {
        this.lastError = lastError;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getStageId() {
        return stageId;
    }

    public void setStageId(String stageId) {
        this.stageId = stageId;
    }
}
