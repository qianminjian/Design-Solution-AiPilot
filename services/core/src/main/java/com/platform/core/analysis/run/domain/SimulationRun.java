package com.platform.core.analysis.run.domain;

import com.platform.core.analysis.domain.enums.RunStatus;
import com.platform.core.common.entity.TenantBaseEntity;
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
 * 模拟运行实体（D37.14 P10 工程分析运行与结果质量）
 *
 * 状态机：
 * QUEUED → LICENSING → PREPARING → RUNNING → POST_PROCESSING → CONVERGED / DIVERGED
 *                                                                ↓
 *                                                              CANCELLED / FAILED
 * UNKNOWN：需 Reconcile（D37.17 retry storm 防护）
 *
 * 安全红线：
 *  - cancel/retry 需 stepUpToken
 *  - retry storm 检测由 Service 层校验
 *  - 完成运行 ≠ 接受结果
 *
 * 表：analysis.simulation_run
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Entity(name = "SimulationRun")
@Table(name = "simulation_run", schema = "analysis")
public class SimulationRun extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联问题 ID */
    @Column(name = "problem_id", nullable = false)
    private UUID problemId;

    /** 关联场景 ID */
    @Column(name = "scenario_id", nullable = false)
    private UUID scenarioId;

    /** 求解器配置 ID */
    @Column(name = "solver_profile_id", nullable = false)
    private UUID solverProfileId;

    /** 求解器配置名称（冗余） */
    @Column(name = "solver_profile_name", length = 200)
    private String solverProfileName;

    /** 运行状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private RunStatus status;

    /** 排队时间 */
    @Column(name = "queued_at")
    private Instant queuedAt;

    /** 启动时间（LICENSING/PREPARING） */
    @Column(name = "started_at")
    private Instant startedAt;

    /** 完成时间（CONVERGED/DIVERGED/CANCELLED/FAILED） */
    @Column(name = "completed_at")
    private Instant completedAt;

    /** 求解器版本（运行时实际版本，便于审计） */
    @Column(name = "solver_version", length = 64)
    private String solverVersion;

    /** 实际耗时（秒） */
    @Column(name = "actual_duration_sec")
    private Integer actualDurationSec;

    /** 实际成本（单位：元） */
    @Column(name = "actual_cost", precision = 12, scale = 4)
    private java.math.BigDecimal actualCost;

    /** 失败原因（FAILED 时填充） */
    @Column(name = "failure_reason", length = 2000)
    private String failureReason;

    /** 重试次数（retry storm 检测依据） */
    @Column(name = "retry_count", nullable = false)
    private int retryCount;

    /** 上游运行 ID（重试链） */
    @Column(name = "parent_run_id")
    private UUID parentRunId;

    /** 是否为 unknown job（需 Reconcile） */
    @Column(name = "is_unknown_job", nullable = false)
    private boolean unknownJob;

    /** 取消人 ID */
    @Column(name = "cancelled_by", length = 200)
    private String cancelledBy;

    /** 取消原因 */
    @Column(name = "cancel_reason", length = 1000)
    private String cancelReason;

    // ── Getters/Setters ──

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getProblemId() {
        return problemId;
    }

    public void setProblemId(UUID problemId) {
        this.problemId = problemId;
    }

    public UUID getScenarioId() {
        return scenarioId;
    }

    public void setScenarioId(UUID scenarioId) {
        this.scenarioId = scenarioId;
    }

    public UUID getSolverProfileId() {
        return solverProfileId;
    }

    public void setSolverProfileId(UUID solverProfileId) {
        this.solverProfileId = solverProfileId;
    }

    public String getSolverProfileName() {
        return solverProfileName;
    }

    public void setSolverProfileName(String solverProfileName) {
        this.solverProfileName = solverProfileName;
    }

    public RunStatus getStatus() {
        return status;
    }

    public void setStatus(RunStatus status) {
        this.status = status;
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

    public String getSolverVersion() {
        return solverVersion;
    }

    public void setSolverVersion(String solverVersion) {
        this.solverVersion = solverVersion;
    }

    public Integer getActualDurationSec() {
        return actualDurationSec;
    }

    public void setActualDurationSec(Integer actualDurationSec) {
        this.actualDurationSec = actualDurationSec;
    }

    public java.math.BigDecimal getActualCost() {
        return actualCost;
    }

    public void setActualCost(java.math.BigDecimal actualCost) {
        this.actualCost = actualCost;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public void setFailureReason(String failureReason) {
        this.failureReason = failureReason;
    }

    public int getRetryCount() {
        return retryCount;
    }

    public void setRetryCount(int retryCount) {
        this.retryCount = retryCount;
    }

    public UUID getParentRunId() {
        return parentRunId;
    }

    public void setParentRunId(UUID parentRunId) {
        this.parentRunId = parentRunId;
    }

    public boolean isUnknownJob() {
        return unknownJob;
    }

    public void setUnknownJob(boolean unknownJob) {
        this.unknownJob = unknownJob;
    }

    public String getCancelledBy() {
        return cancelledBy;
    }

    public void setCancelledBy(String cancelledBy) {
        this.cancelledBy = cancelledBy;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public void setCancelReason(String cancelReason) {
        this.cancelReason = cancelReason;
    }
}
