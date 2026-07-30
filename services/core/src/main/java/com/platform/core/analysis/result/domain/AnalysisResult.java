package com.platform.core.analysis.result.domain;

import com.platform.core.analysis.domain.enums.ResultQualityStatus;
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
 * 分析结果实体（D37.14 P10 工程分析运行与结果质量）
 *
 * 状态机：
 * PENDING → VALID / QUESTIONABLE / INVALID
 * VALID / QUESTIONABLE → SUPERSEDED（被新结果取代）
 *
 * 安全红线：
 *  - 完成运行 ≠ 接受结果：质量评估须由具备资质的人员完成
 *  - 决策 ACCEPT_AS_REVISION / EXCEPTION 需注册师签章
 *  - supersede 需记录取代关系
 *
 * 表：analysis.analysis_result
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Entity(name = "AnalysisResult")
@Table(name = "analysis_result", schema = "analysis")
public class AnalysisResult extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联运行 ID */
    @Column(name = "run_id", nullable = false)
    private UUID runId;

    /** 关联问题 ID（冗余，便于按问题查询结果） */
    @Column(name = "problem_id", nullable = false)
    private UUID problemId;

    /** 结果包名称 */
    @Column(name = "name", nullable = false, length = 500)
    private String name;

    /** 质量状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "quality_status", nullable = false, length = 32)
    private ResultQualityStatus qualityStatus;

    /** 生成时间 */
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;

    /** 文件大小（MB） */
    @Column(name = "size_mb", nullable = false, precision = 12, scale = 4)
    private java.math.BigDecimal sizeMb;

    /** 包含变量列表（JSON 数组） */
    @Column(name = "variables", columnDefinition = "jsonb")
    private String variables = "[]";

    /** 包含 case 列表（JSON 数组） */
    @Column(name = "cases", columnDefinition = "jsonb")
    private String cases = "[]";

    /** 时间步数 */
    @Column(name = "time_steps", nullable = false)
    private int timeSteps;

    /** 空间网格点数 */
    @Column(name = "spatial_points", nullable = false)
    private int spatialPoints;

    /** 关键指标摘要（JSON 数组：[{name, value, unit, withinThreshold, threshold?}]） */
    @Column(name = "metrics", columnDefinition = "jsonb")
    private String metrics = "[]";

    /** Benchmark 对比（JSON：{benchmarkName, deviationPercent, passed}） */
    @Column(name = "benchmark_comparison", columnDefinition = "jsonb")
    private String benchmarkComparison = "{}";

    /** 下载 URL */
    @Column(name = "download_url", length = 500)
    private String downloadUrl;

    /** 是否被 superseded */
    @Column(name = "superseded_by")
    private UUID supersededBy;

    /** supersede 时间 */
    @Column(name = "superseded_at")
    private Instant supersededAt;

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

    public UUID getProblemId() {
        return problemId;
    }

    public void setProblemId(UUID problemId) {
        this.problemId = problemId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public ResultQualityStatus getQualityStatus() {
        return qualityStatus;
    }

    public void setQualityStatus(ResultQualityStatus qualityStatus) {
        this.qualityStatus = qualityStatus;
    }

    public Instant getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(Instant generatedAt) {
        this.generatedAt = generatedAt;
    }

    public java.math.BigDecimal getSizeMb() {
        return sizeMb;
    }

    public void setSizeMb(java.math.BigDecimal sizeMb) {
        this.sizeMb = sizeMb;
    }

    public String getVariables() {
        return variables;
    }

    public void setVariables(String variables) {
        this.variables = variables;
    }

    public String getCases() {
        return cases;
    }

    public void setCases(String cases) {
        this.cases = cases;
    }

    public int getTimeSteps() {
        return timeSteps;
    }

    public void setTimeSteps(int timeSteps) {
        this.timeSteps = timeSteps;
    }

    public int getSpatialPoints() {
        return spatialPoints;
    }

    public void setSpatialPoints(int spatialPoints) {
        this.spatialPoints = spatialPoints;
    }

    public String getMetrics() {
        return metrics;
    }

    public void setMetrics(String metrics) {
        this.metrics = metrics;
    }

    public String getBenchmarkComparison() {
        return benchmarkComparison;
    }

    public void setBenchmarkComparison(String benchmarkComparison) {
        this.benchmarkComparison = benchmarkComparison;
    }

    public String getDownloadUrl() {
        return downloadUrl;
    }

    public void setDownloadUrl(String downloadUrl) {
        this.downloadUrl = downloadUrl;
    }

    public UUID getSupersededBy() {
        return supersededBy;
    }

    public void setSupersededBy(UUID supersededBy) {
        this.supersededBy = supersededBy;
    }

    public Instant getSupersededAt() {
        return supersededAt;
    }

    public void setSupersededAt(Instant supersededAt) {
        this.supersededAt = supersededAt;
    }
}
