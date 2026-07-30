package com.platform.core.analysis.run.domain;

import com.platform.core.analysis.domain.enums.ConvergenceStatus;
import com.platform.core.common.entity.TenantBaseEntity;
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
 * 收敛指标实体（D37.14 P10 工程分析运行与结果质量）
 *
 * 记录运行过程的收敛指标，用于前端 Run Monitor 收敛曲线展示。
 *
 * 表：analysis.convergence_metric
 * 字段对齐 V20__init_analysis.sql
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Entity(name = "ConvergenceMetric")
@Table(name = "convergence_metric", schema = "analysis")
public class ConvergenceMetric extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联运行 ID */
    @Column(name = "run_id", nullable = false)
    private UUID runId;

    /** 迭代号 */
    @Column(name = "iteration", nullable = false)
    private int iteration;

    /** 残差值 */
    @Column(name = "residual", nullable = false, precision = 12, scale = 6)
    private BigDecimal residual;

    /** 收敛状态：CONVERGING/CONVERGED/DIVERGING/DIVERGED */
    @Enumerated(EnumType.STRING)
    @Column(name = "convergence_status", nullable = false, length = 16)
    private ConvergenceStatus convergenceStatus;

    /** 发生时间 */
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

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

    public int getIteration() {
        return iteration;
    }

    public void setIteration(int iteration) {
        this.iteration = iteration;
    }

    public BigDecimal getResidual() {
        return residual;
    }

    public void setResidual(BigDecimal residual) {
        this.residual = residual;
    }

    public ConvergenceStatus getConvergenceStatus() {
        return convergenceStatus;
    }

    public void setConvergenceStatus(ConvergenceStatus convergenceStatus) {
        this.convergenceStatus = convergenceStatus;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(Instant occurredAt) {
        this.occurredAt = occurredAt;
    }
}
