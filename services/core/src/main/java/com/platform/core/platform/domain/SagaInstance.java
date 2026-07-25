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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Saga 实例实体
 *
 * <p>对应数据库表 {@code platform.saga_instance}（V5 迁移脚本创建）
 *
 * <p>权威源：@design/D34-数据-数据库.md §3
 *
 * <p>Saga 模式核心：跨服务长事务编排，每步成功后写入步骤历史，
 * 失败时按步骤历史反向补偿。本类仅记录 Saga 元状态，
 * 实际步骤执行逻辑由 {@code SagaCoordinator} 与具体 Saga 实现承担。
 *
 * <p>核心不变量：
 * <ul>
 *   <li>状态机：STARTED → COMPLETED/COMPENSATING/ABORTED</li>
 *   <li>COMPENSATING → COMPENSATED 或 FAILED</li>
 *   <li>completedSteps 是有序的，补偿按其逆序执行</li>
 * </ul>
 */
@Entity
@Table(name = "saga_instance", schema = "platform")
public class SagaInstance {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "saga_type", nullable = false)
    private String sagaType;

    @Column(name = "aggregate_type", nullable = false)
    private String aggregateType;

    @Column(name = "aggregate_id", nullable = false)
    private UUID aggregateId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private SagaStatus status = SagaStatus.STARTED;

    @Column(name = "current_step")
    private String currentStep;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "completed_steps", columnDefinition = "jsonb")
    private List<String> completedSteps = List.of();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context_payload", columnDefinition = "jsonb")
    private Map<String, Object> contextPayload = new LinkedHashMap<>();

    @Column(name = "trace_id")
    private String traceId;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "row_version")
    private Long rowVersion;

    /**
     * JPA 无参构造（Hibernate 要求）
     * 业务代码请使用 {@link #start(...)} 工厂方法
     */
    public SagaInstance() {
    }

    /**
     * 工厂方法：启动一个新 Saga 实例
     *
     * @param tenantId       租户 ID
     * @param sagaType       Saga 类型（如 "ProjectCreationSaga"、"GateDecisionSaga"）
     * @param aggregateType  关联聚合根类型
     * @param aggregateId    关联聚合根 ID
     * @param initialContext 初始上下文负载（可空）
     * @param traceId        追踪 ID（可空）
     */
    public static SagaInstance start(UUID tenantId,
                                    String sagaType,
                                    String aggregateType,
                                    UUID aggregateId,
                                    Map<String, Object> initialContext,
                                    String traceId) {
        SagaInstance saga = new SagaInstance();
        saga.id = UUID.randomUUID();
        saga.tenantId = tenantId;
        saga.sagaType = sagaType;
        saga.aggregateType = aggregateType;
        saga.aggregateId = aggregateId;
        saga.status = SagaStatus.STARTED;
        saga.completedSteps = List.of();
        saga.contextPayload = initialContext != null ? initialContext : new LinkedHashMap<>();
        saga.traceId = traceId;
        saga.startedAt = Instant.now();
        return saga;
    }

    /**
     * 推进到下一步
     *
     * @param nextStep 下一步名称
     */
    public void advanceTo(String nextStep) {
        // 完成当前步并加入已完成列表
        if (this.currentStep != null) {
            this.completedSteps = new java.util.ArrayList<>(this.completedSteps);
            ((java.util.List<String>) this.completedSteps).add(this.currentStep);
        }
        this.currentStep = nextStep;
    }

    /**
     * 标记为已完成
     */
    public void markCompleted() {
        if (this.currentStep != null) {
            this.completedSteps = new java.util.ArrayList<>(this.completedSteps);
            ((java.util.List<String>) this.completedSteps).add(this.currentStep);
            this.currentStep = null;
        }
        this.status = SagaStatus.COMPLETED;
        this.completedAt = Instant.now();
    }

    /**
     * 标记为补偿中
     *
     * @param error 失败原因
     */
    public void markCompensating(String error) {
        this.status = SagaStatus.COMPENSATING;
        this.lastError = error;
    }

    /**
     * 标记为已补偿（补偿成功，终态）
     */
    public void markCompensated() {
        this.status = SagaStatus.COMPENSATED;
        this.completedAt = Instant.now();
    }

    /**
     * 标记为失败（补偿失败，需人工介入，终态）
     *
     * @param error 失败原因
     */
    public void markFailed(String error) {
        this.status = SagaStatus.FAILED;
        this.lastError = error;
        this.completedAt = Instant.now();
    }

    /**
     * 标记为已中止（业务主动取消，终态）
     *
     * @param reason 中止原因
     */
    public void markAborted(String reason) {
        this.status = SagaStatus.ABORTED;
        this.lastError = reason;
        this.completedAt = Instant.now();
    }

    // ── Getter / Setter ──

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getSagaType() { return sagaType; }
    public void setSagaType(String sagaType) { this.sagaType = sagaType; }

    public String getAggregateType() { return aggregateType; }
    public void setAggregateType(String aggregateType) { this.aggregateType = aggregateType; }

    public UUID getAggregateId() { return aggregateId; }
    public void setAggregateId(UUID aggregateId) { this.aggregateId = aggregateId; }

    public SagaStatus getStatus() { return status; }
    public void setStatus(SagaStatus status) { this.status = status; }

    public String getCurrentStep() { return currentStep; }
    public void setCurrentStep(String currentStep) { this.currentStep = currentStep; }

    public List<String> getCompletedSteps() { return completedSteps; }
    public void setCompletedSteps(List<String> completedSteps) { this.completedSteps = completedSteps; }

    public Map<String, Object> getContextPayload() { return contextPayload; }
    public void setContextPayload(Map<String, Object> contextPayload) { this.contextPayload = contextPayload; }

    public String getTraceId() { return traceId; }
    public void setTraceId(String traceId) { this.traceId = traceId; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public Long getRowVersion() { return rowVersion; }
    public void setRowVersion(Long rowVersion) { this.rowVersion = rowVersion; }
}
