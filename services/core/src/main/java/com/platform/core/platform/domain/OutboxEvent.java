package com.platform.core.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Outbox 事件发件箱实体
 *
 * <p>对应数据库表 {@code platform.outbox_event}（V4__init_ai_outbox_seed.sql §2）
 *
 * <p>权威源：@design/D34-数据-数据库.md §3（聚合间事件一致；跨服务不用分布式事务，
 * 以 Transactional Outbox、幂等消费者和 Saga/补偿实现）
 *
 * <p>核心不变量：
 * <ul>
 *   <li>事件状态机：PENDING → PUBLISHED；PENDING → FAILED → DEAD_LETTER</li>
 *   <li>同事务写入：与聚合根状态变更在同一数据库事务内完成，确保事件不丢失</li>
 *   <li>幂等性：消费者基于 (aggregate_type, aggregate_id, aggregate_version) 去重</li>
 * </ul>
 */
@Entity
@Table(name = "outbox_event", schema = "platform")
public class OutboxEvent {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "aggregate_type", nullable = false)
    private String aggregateType;

    @Column(name = "aggregate_id", nullable = false)
    private UUID aggregateId;

    @Column(name = "aggregate_version", nullable = false)
    private Long aggregateVersion;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "schema_version", nullable = false)
    private String schemaVersion = "1.0";

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> payload;

    @Column(name = "trace_id")
    private String traceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private OutboxEventStatus status = OutboxEventStatus.PENDING;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "publish_attempts", nullable = false)
    private Integer publishAttempts = 0;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "next_retry_at")
    private Instant nextRetryAt;

    @Column(name = "classification", nullable = false)
    @Enumerated(EnumType.STRING)
    private com.platform.core.iam.domain.DataClassification classification =
            com.platform.core.iam.domain.DataClassification.OPERATIONAL_TELEMETRY;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Version
    @Column(name = "row_version")
    private Long rowVersion;

    /**
     * JPA 无参构造（Hibernate 要求）
     * 业务代码请使用 {@link #create(...)} 工厂方法
     */
    public OutboxEvent() {
    }

    /**
     * 工厂方法：构造 PENDING 状态的 Outbox 事件
     *
     * @param tenantId         租户 ID
     * @param projectId        项目 ID（可空）
     * @param aggregateType    聚合根类型（如 "Project"、"GateDecision"）
     * @param aggregateId      聚合根 ID
     * @param aggregateVersion 聚合根版本（用于消费者检测乱序）
     * @param eventType        事件类型（如 "ProjectCreated"、"GateDecided"）
     * @param payload          事件负载（JSON 友好 Map）
     * @param traceId          追踪 ID（贯穿调用链）
     */
    public static OutboxEvent create(UUID tenantId,
                                     UUID projectId,
                                     String aggregateType,
                                     UUID aggregateId,
                                     Long aggregateVersion,
                                     String eventType,
                                     Map<String, Object> payload,
                                     String traceId) {
        OutboxEvent event = new OutboxEvent();
        event.id = UUID.randomUUID();
        event.tenantId = tenantId;
        event.projectId = projectId;
        event.aggregateType = aggregateType;
        event.aggregateId = aggregateId;
        event.aggregateVersion = aggregateVersion;
        event.eventType = eventType;
        event.occurredAt = Instant.now();
        // null payload 用空 Map 占位，避免 JSONB 序列化失败
        event.payload = payload != null ? payload : new java.util.LinkedHashMap<>();
        event.traceId = traceId;
        event.status = OutboxEventStatus.PENDING;
        event.publishAttempts = 0;
        return event;
    }

    /**
     * 标记为已发布
     */
    public void markPublished() {
        this.status = OutboxEventStatus.PUBLISHED;
        this.publishedAt = Instant.now();
    }

    /**
     * 记录发布失败，递增尝试次数并设置下次重试时间
     *
     * @param error 错误描述
     * @param maxAttempts 最大尝试次数（超过则进入死信）
     * @param retryDelaySeconds 下次重试延迟（秒）
     */
    public void recordFailure(String error, int maxAttempts, long retryDelaySeconds) {
        this.publishAttempts = this.publishAttempts + 1;
        this.lastError = error;
        if (this.publishAttempts >= maxAttempts) {
            this.status = OutboxEventStatus.DEAD_LETTER;
        } else {
            this.status = OutboxEventStatus.FAILED;
            this.nextRetryAt = Instant.now().plusSeconds(retryDelaySeconds);
        }
    }

    // ── Getter / Setter ──

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public UUID getProjectId() { return projectId; }
    public void setProjectId(UUID projectId) { this.projectId = projectId; }

    public String getAggregateType() { return aggregateType; }
    public void setAggregateType(String aggregateType) { this.aggregateType = aggregateType; }

    public UUID getAggregateId() { return aggregateId; }
    public void setAggregateId(UUID aggregateId) { this.aggregateId = aggregateId; }

    public Long getAggregateVersion() { return aggregateVersion; }
    public void setAggregateVersion(Long aggregateVersion) { this.aggregateVersion = aggregateVersion; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getSchemaVersion() { return schemaVersion; }
    public void setSchemaVersion(String schemaVersion) { this.schemaVersion = schemaVersion; }

    public Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(Instant occurredAt) { this.occurredAt = occurredAt; }

    public Map<String, Object> getPayload() { return payload; }
    public void setPayload(Map<String, Object> payload) { this.payload = payload; }

    public String getTraceId() { return traceId; }
    public void setTraceId(String traceId) { this.traceId = traceId; }

    public OutboxEventStatus getStatus() { return status; }
    public void setStatus(OutboxEventStatus status) { this.status = status; }

    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }

    public Integer getPublishAttempts() { return publishAttempts; }
    public void setPublishAttempts(Integer publishAttempts) { this.publishAttempts = publishAttempts; }

    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }

    public Instant getNextRetryAt() { return nextRetryAt; }
    public void setNextRetryAt(Instant nextRetryAt) { this.nextRetryAt = nextRetryAt; }

    public com.platform.core.iam.domain.DataClassification getClassification() { return classification; }
    public void setClassification(com.platform.core.iam.domain.DataClassification classification) {
        this.classification = classification;
    }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Long getRowVersion() { return rowVersion; }
    public void setRowVersion(Long rowVersion) { this.rowVersion = rowVersion; }
}
