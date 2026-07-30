package com.platform.core.analysis.scenario.domain;

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
 * 工程分析场景实体（D37.14 P10 工程分析运行与结果质量）
 *
 * 场景是问题的子实体，包含求解器配置 + 网格密度 + 参数组合。
 *
 * 表：analysis.analysis_scenario
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Entity(name = "AnalysisScenario")
@Table(name = "analysis_scenario", schema = "analysis")
public class AnalysisScenario extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联问题 ID */
    @Column(name = "problem_id", nullable = false)
    private UUID problemId;

    /** 场景名称 */
    @Column(name = "name", nullable = false, length = 500)
    private String name;

    /** 场景描述 */
    @Column(name = "description", length = 2000)
    private String description;

    /** 场景类型：BASELINE/WHAT_IF/OPTIMIZATION/SENSITIVITY/VERIFICATION */
    @Column(name = "scenario_type", nullable = false, length = 32)
    private String scenarioType;

    /** 参数组合（JSON 对象） */
    @Column(name = "parameters", columnDefinition = "jsonb")
    private String parameters = "{}";

    /** 是否为基线场景 */
    @Column(name = "is_baseline", nullable = false)
    private boolean baseline;

    /** 是否 AI 推荐场景（须人工确认后才可用于运行） */
    @Column(name = "is_ai_recommended", nullable = false)
    private boolean aiRecommended;

    /** AI 推荐理由 */
    @Column(name = "ai_recommendation_reason", length = 2000)
    private String aiRecommendationReason;

    /** 确认人（AI 推荐场景须由具备资质的人员确认） */
    @Column(name = "confirmed_by", length = 200)
    private String confirmedBy;

    /** 确认时间 */
    @Column(name = "confirmed_at")
    private Instant confirmedAt;

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getScenarioType() {
        return scenarioType;
    }

    public void setScenarioType(String scenarioType) {
        this.scenarioType = scenarioType;
    }

    public String getParameters() {
        return parameters;
    }

    public void setParameters(String parameters) {
        this.parameters = parameters;
    }

    public boolean isBaseline() {
        return baseline;
    }

    public void setBaseline(boolean baseline) {
        this.baseline = baseline;
    }

    public boolean isAiRecommended() {
        return aiRecommended;
    }

    public void setAiRecommended(boolean aiRecommended) {
        this.aiRecommended = aiRecommended;
    }

    public String getAiRecommendationReason() {
        return aiRecommendationReason;
    }

    public void setAiRecommendationReason(String aiRecommendationReason) {
        this.aiRecommendationReason = aiRecommendationReason;
    }

    public String getConfirmedBy() {
        return confirmedBy;
    }

    public void setConfirmedBy(String confirmedBy) {
        this.confirmedBy = confirmedBy;
    }

    public Instant getConfirmedAt() {
        return confirmedAt;
    }

    public void setConfirmedAt(Instant confirmedAt) {
        this.confirmedAt = confirmedAt;
    }
}
