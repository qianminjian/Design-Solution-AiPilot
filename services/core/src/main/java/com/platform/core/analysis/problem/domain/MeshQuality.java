package com.platform.core.analysis.problem.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * 网格质量摘要实体（D37.14 P10 工程分析运行与结果质量）
 *
 * 记录问题对应的网格质量统计，用于前端展示网格质量等级。
 *
 * 表：analysis.mesh_quality
 * 字段对齐 V20__init_analysis.sql
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Entity(name = "MeshQuality")
@Table(name = "mesh_quality", schema = "analysis")
public class MeshQuality extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联问题 ID */
    @Column(name = "problem_id", nullable = false)
    private UUID problemId;

    /** 总单元数 */
    @Column(name = "total_elements", nullable = false)
    private long totalElements;

    /** 总节点数 */
    @Column(name = "total_nodes", nullable = false)
    private long totalNodes;

    /** 最小质量 */
    @Column(name = "min_quality", nullable = false, precision = 8, scale = 6)
    private BigDecimal minQuality;

    /** 最大质量 */
    @Column(name = "max_quality", nullable = false, precision = 8, scale = 6)
    private BigDecimal maxQuality;

    /** 平均质量 */
    @Column(name = "avg_quality", nullable = false, precision = 8, scale = 6)
    private BigDecimal avgQuality;

    /** 最大长宽比 */
    @Column(name = "aspect_ratio_max", precision = 12, scale = 4)
    private BigDecimal aspectRatioMax;

    /** 平均长宽比 */
    @Column(name = "aspect_ratio_avg", precision = 12, scale = 4)
    private BigDecimal aspectRatioAvg;

    /** 最大偏斜度 */
    @Column(name = "skewness_max", precision = 8, scale = 6)
    private BigDecimal skewnessMax;

    /** 平均偏斜度 */
    @Column(name = "skewness_avg", precision = 8, scale = 6)
    private BigDecimal skewnessAvg;

    /** 最小正交比 */
    @Column(name = "orthogonal_ratio_min", precision = 8, scale = 6)
    private BigDecimal orthogonalRatioMin;

    /** 差质量单元数 */
    @Column(name = "poor_element_count", nullable = false)
    private long poorElementCount;

    /** 差质量单元百分比 */
    @Column(name = "poor_element_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal poorElementPercent;

    /** 质量状态：PENDING/ACCEPTABLE/QUESTIONABLE/UNACCEPTABLE */
    @Column(name = "quality_status", nullable = false, length = 16)
    private String qualityStatus;

    /** 评估时间 */
    @Column(name = "assessed_at")
    private Instant assessedAt;

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

    public long getTotalElements() {
        return totalElements;
    }

    public void setTotalElements(long totalElements) {
        this.totalElements = totalElements;
    }

    public long getTotalNodes() {
        return totalNodes;
    }

    public void setTotalNodes(long totalNodes) {
        this.totalNodes = totalNodes;
    }

    public BigDecimal getMinQuality() {
        return minQuality;
    }

    public void setMinQuality(BigDecimal minQuality) {
        this.minQuality = minQuality;
    }

    public BigDecimal getMaxQuality() {
        return maxQuality;
    }

    public void setMaxQuality(BigDecimal maxQuality) {
        this.maxQuality = maxQuality;
    }

    public BigDecimal getAvgQuality() {
        return avgQuality;
    }

    public void setAvgQuality(BigDecimal avgQuality) {
        this.avgQuality = avgQuality;
    }

    public BigDecimal getAspectRatioMax() {
        return aspectRatioMax;
    }

    public void setAspectRatioMax(BigDecimal aspectRatioMax) {
        this.aspectRatioMax = aspectRatioMax;
    }

    public BigDecimal getAspectRatioAvg() {
        return aspectRatioAvg;
    }

    public void setAspectRatioAvg(BigDecimal aspectRatioAvg) {
        this.aspectRatioAvg = aspectRatioAvg;
    }

    public BigDecimal getSkewnessMax() {
        return skewnessMax;
    }

    public void setSkewnessMax(BigDecimal skewnessMax) {
        this.skewnessMax = skewnessMax;
    }

    public BigDecimal getSkewnessAvg() {
        return skewnessAvg;
    }

    public void setSkewnessAvg(BigDecimal skewnessAvg) {
        this.skewnessAvg = skewnessAvg;
    }

    public BigDecimal getOrthogonalRatioMin() {
        return orthogonalRatioMin;
    }

    public void setOrthogonalRatioMin(BigDecimal orthogonalRatioMin) {
        this.orthogonalRatioMin = orthogonalRatioMin;
    }

    public long getPoorElementCount() {
        return poorElementCount;
    }

    public void setPoorElementCount(long poorElementCount) {
        this.poorElementCount = poorElementCount;
    }

    public BigDecimal getPoorElementPercent() {
        return poorElementPercent;
    }

    public void setPoorElementPercent(BigDecimal poorElementPercent) {
        this.poorElementPercent = poorElementPercent;
    }

    public String getQualityStatus() {
        return qualityStatus;
    }

    public void setQualityStatus(String qualityStatus) {
        this.qualityStatus = qualityStatus;
    }

    public Instant getAssessedAt() {
        return assessedAt;
    }

    public void setAssessedAt(Instant assessedAt) {
        this.assessedAt = assessedAt;
    }
}
