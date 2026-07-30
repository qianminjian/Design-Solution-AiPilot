package com.platform.core.analysis.run.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * 运行时间线事件实体（D37.14 P10 工程分析运行与结果质量）
 *
 * 记录运行过程的关键事件，用于前端 Run Monitor 展示。
 *
 * 表：analysis.run_timeline_event
 * 字段对齐 V20__init_analysis.sql
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Entity(name = "RunTimelineEvent")
@Table(name = "run_timeline_event", schema = "analysis")
public class RunTimelineEvent extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联运行 ID */
    @Column(name = "run_id", nullable = false)
    private UUID runId;

    /** 事件类型：QUEUED/LICENSING/PREPARING/RUNNING/POST_PROCESSING/CONVERGED/DIVERGED/CANCELLED/FAILED/UNKNOWN/RETRY/RECONCILE */
    @Column(name = "event_type", nullable = false, length = 32)
    private String eventType;

    /** 状态变更：起始状态 */
    @Column(name = "status_from", length = 32)
    private String statusFrom;

    /** 状态变更：目标状态 */
    @Column(name = "status_to", length = 32)
    private String statusTo;

    /** 事件发生时间 */
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    /** 持续时长（毫秒） */
    @Column(name = "duration_ms")
    private Integer durationMs;

    /** 操作人 ID（PII: L2） */
    @Column(name = "operator_id", length = 200)
    private String operatorId;

    /** 事件消息 */
    @Column(name = "message", length = 2000)
    private String message;

    /** 元数据（JSON） */
    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata = "{}";

    /** 全链路追踪 ID */
    @Column(name = "trace_id", length = 128)
    private String traceId;

    // ── Getters/Setters ──

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getRunId() {
        return runId;
    }

    public void setRunId(UUID runId) {
        this.runId = runId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getStatusFrom() {
        return statusFrom;
    }

    public void setStatusFrom(String statusFrom) {
        this.statusFrom = statusFrom;
    }

    public String getStatusTo() {
        return statusTo;
    }

    public void setStatusTo(String statusTo) {
        this.statusTo = statusTo;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(Instant occurredAt) {
        this.occurredAt = occurredAt;
    }

    public Integer getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Integer durationMs) {
        this.durationMs = durationMs;
    }

    public String getOperatorId() {
        return operatorId;
    }

    public void setOperatorId(String operatorId) {
        this.operatorId = operatorId;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }
}
