package com.platform.core.analysis.problem.domain;

import com.platform.core.analysis.domain.enums.AnalysisProblemType;
import com.platform.core.analysis.domain.enums.ProblemStatus;
import com.platform.core.analysis.domain.enums.ResultQualityStatus;
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
 * 工程分析问题实体（D37.14 P10 工程分析运行与结果质量）
 *
 * 状态机：
 * DRAFT → READY → RUNNING → COMPLETED → REVIEWED
 *      ↓ (任意阶段) → INVALID（输入过期 / Baseline 变化）
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - 高风险动作（submit/invalidate）需 stepUpToken 二次认证
 *  - AI 辅助推荐场景/参数须人工确认
 *  - 完成运行 ≠ 接受结果：质量评估须由具备资质的人员完成
 *
 * 表：analysis.analysis_problem
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Entity(name = "AnalysisProblem")
@Table(name = "analysis_problem", schema = "analysis")
public class AnalysisProblem extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 问题编号（业务可读，如 AN-2026-001） */
    @Column(name = "code", nullable = false, unique = true, length = 64)
    private String code;

    /** 问题标题 */
    @Column(name = "title", nullable = false, length = 500)
    private String title;

    /** 问题类型 */
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private AnalysisProblemType type;

    /** 问题状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ProblemStatus status;

    /** 问题描述 */
    @Column(name = "description", length = 4000)
    private String description;

    /** 关联项目 ID */
    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    /** 关联项目名称（冗余，前端展示用） */
    @Column(name = "project_name", length = 200)
    private String projectName;

    /** Baseline ID（输入基线） */
    @Column(name = "baseline_id", length = 64)
    private String baselineId;

    /** Baseline Hash（用于变更检测） */
    @Column(name = "baseline_hash", length = 128)
    private String baselineHash;

    /** 负责人 ID */
    @Column(name = "owner", nullable = false, length = 200)
    private String owner;

    /** 负责人角色 */
    @Column(name = "owner_role", nullable = false, length = 100)
    private String ownerRole;

    /** 输入完整性百分比（0-100） */
    @Column(name = "input_completeness", nullable = false)
    private int inputCompleteness;

    /** 假设条目数 */
    @Column(name = "assumption_count", nullable = false)
    private int assumptionCount;

    /** 边界条件数 */
    @Column(name = "boundary_condition_count", nullable = false)
    private int boundaryConditionCount;

    /** 荷载工况数 */
    @Column(name = "load_case_count", nullable = false)
    private int loadCaseCount;

    /** 已运行次数 */
    @Column(name = "run_count", nullable = false)
    private int runCount;

    /** 最近运行 ID */
    @Column(name = "latest_run_id")
    private UUID latestRunId;

    /** 最近运行状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "latest_run_status", length = 32)
    private RunStatus latestRunStatus;

    /** 最近结果质量状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "latest_result_quality", length = 32)
    private ResultQualityStatus latestResultQuality;

    /** 是否需要人工复核 */
    @Column(name = "requires_human_review", nullable = false)
    private boolean requiresHumanReview;

    /** 是否 AI 辅助 */
    @Column(name = "is_ai_assisted", nullable = false)
    private boolean aiAssisted;

    /** AI 辅助分析（V1 接入 LLM Provider，JSON） */
    @Column(name = "ai_assisted_analysis", columnDefinition = "jsonb")
    private String aiAssistedAnalysis = "{}";

    /** 提交就绪时间（DRAFT → READY） */
    @Column(name = "submitted_at")
    private Instant submittedAt;

    /** 失效时间 */
    @Column(name = "invalidated_at")
    private Instant invalidatedAt;

    /** 失效原因 */
    @Column(name = "invalidation_reason", length = 1000)
    private String invalidationReason;

    // ── Getters/Setters ──

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public AnalysisProblemType getType() {
        return type;
    }

    public void setType(AnalysisProblemType type) {
        this.type = type;
    }

    public ProblemStatus getStatus() {
        return status;
    }

    public void setStatus(ProblemStatus status) {
        this.status = status;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public String getBaselineId() {
        return baselineId;
    }

    public void setBaselineId(String baselineId) {
        this.baselineId = baselineId;
    }

    public String getBaselineHash() {
        return baselineHash;
    }

    public void setBaselineHash(String baselineHash) {
        this.baselineHash = baselineHash;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    public String getOwnerRole() {
        return ownerRole;
    }

    public void setOwnerRole(String ownerRole) {
        this.ownerRole = ownerRole;
    }

    public int getInputCompleteness() {
        return inputCompleteness;
    }

    public void setInputCompleteness(int inputCompleteness) {
        this.inputCompleteness = inputCompleteness;
    }

    public int getAssumptionCount() {
        return assumptionCount;
    }

    public void setAssumptionCount(int assumptionCount) {
        this.assumptionCount = assumptionCount;
    }

    public int getBoundaryConditionCount() {
        return boundaryConditionCount;
    }

    public void setBoundaryConditionCount(int boundaryConditionCount) {
        this.boundaryConditionCount = boundaryConditionCount;
    }

    public int getLoadCaseCount() {
        return loadCaseCount;
    }

    public void setLoadCaseCount(int loadCaseCount) {
        this.loadCaseCount = loadCaseCount;
    }

    public int getRunCount() {
        return runCount;
    }

    public void setRunCount(int runCount) {
        this.runCount = runCount;
    }

    public UUID getLatestRunId() {
        return latestRunId;
    }

    public void setLatestRunId(UUID latestRunId) {
        this.latestRunId = latestRunId;
    }

    public RunStatus getLatestRunStatus() {
        return latestRunStatus;
    }

    public void setLatestRunStatus(RunStatus latestRunStatus) {
        this.latestRunStatus = latestRunStatus;
    }

    public ResultQualityStatus getLatestResultQuality() {
        return latestResultQuality;
    }

    public void setLatestResultQuality(ResultQualityStatus latestResultQuality) {
        this.latestResultQuality = latestResultQuality;
    }

    public boolean isRequiresHumanReview() {
        return requiresHumanReview;
    }

    public void setRequiresHumanReview(boolean requiresHumanReview) {
        this.requiresHumanReview = requiresHumanReview;
    }

    public boolean isAiAssisted() {
        return aiAssisted;
    }

    public void setAiAssisted(boolean aiAssisted) {
        this.aiAssisted = aiAssisted;
    }

    public String getAiAssistedAnalysis() {
        return aiAssistedAnalysis;
    }

    public void setAiAssistedAnalysis(String aiAssistedAnalysis) {
        this.aiAssistedAnalysis = aiAssistedAnalysis;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Instant submittedAt) {
        this.submittedAt = submittedAt;
    }

    public Instant getInvalidatedAt() {
        return invalidatedAt;
    }

    public void setInvalidatedAt(Instant invalidatedAt) {
        this.invalidatedAt = invalidatedAt;
    }

    public String getInvalidationReason() {
        return invalidationReason;
    }

    public void setInvalidationReason(String invalidationReason) {
        this.invalidationReason = invalidationReason;
    }
}
