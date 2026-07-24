package com.platform.core.ai.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import jakarta.persistence.*;

import java.util.UUID;

/**
 * AI 生成记录实体 — 审计追溯
 *
 * 记录每次 AI 方案生成的完整上下文（输入 prompt、输出候选、模型、guardrails 结果、traceId）。
 * 与 DesignOption 通过 designOptionId 关联（接受候选为设计选项时回填）。
 */
@Entity
@Table(name = "ai_generation_record")
public class AiGenerationRecord extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false)
    private UUID projectId;

    /** 关联设计选项（接受候选后回填） */
    @Column
    private UUID designOptionId;

    @Column(nullable = false, length = 128)
    private String promptTemplate;

    @Column(columnDefinition = "jsonb")
    private String variables;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String renderedPrompt;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String rawContent;

    @Column(nullable = false, columnDefinition = "jsonb")
    private String candidates;

    @Column(nullable = false, length = 64)
    private String model;

    @Column(nullable = false, columnDefinition = "jsonb")
    private String tokenUsage;

    @Column(nullable = false, length = 16)
    private String riskLevel;

    @Column(nullable = false, columnDefinition = "jsonb")
    private String guardrailResult;

    @Column(nullable = false)
    private Boolean requiresHumanReview = Boolean.TRUE;

    @Column(nullable = false)
    private Integer latencyMs = 0;

    @Column(length = 64)
    private String traceId;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getProjectId() { return projectId; }
    public void setProjectId(UUID projectId) { this.projectId = projectId; }
    public UUID getDesignOptionId() { return designOptionId; }
    public void setDesignOptionId(UUID designOptionId) { this.designOptionId = designOptionId; }
    public String getPromptTemplate() { return promptTemplate; }
    public void setPromptTemplate(String promptTemplate) { this.promptTemplate = promptTemplate; }
    public String getVariables() { return variables; }
    public void setVariables(String variables) { this.variables = variables; }
    public String getRenderedPrompt() { return renderedPrompt; }
    public void setRenderedPrompt(String renderedPrompt) { this.renderedPrompt = renderedPrompt; }
    public String getRawContent() { return rawContent; }
    public void setRawContent(String rawContent) { this.rawContent = rawContent; }
    public String getCandidates() { return candidates; }
    public void setCandidates(String candidates) { this.candidates = candidates; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public String getTokenUsage() { return tokenUsage; }
    public void setTokenUsage(String tokenUsage) { this.tokenUsage = tokenUsage; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    public String getGuardrailResult() { return guardrailResult; }
    public void setGuardrailResult(String guardrailResult) { this.guardrailResult = guardrailResult; }
    public Boolean getRequiresHumanReview() { return requiresHumanReview; }
    public void setRequiresHumanReview(Boolean requiresHumanReview) { this.requiresHumanReview = requiresHumanReview; }
    public Integer getLatencyMs() { return latencyMs; }
    public void setLatencyMs(Integer latencyMs) { this.latencyMs = latencyMs; }
    public String getTraceId() { return traceId; }
    public void setTraceId(String traceId) { this.traceId = traceId; }
}
