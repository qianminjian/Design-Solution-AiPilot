package com.platform.core.change.request.domain;

import com.platform.core.change.domain.enums.ChangePriority;
import com.platform.core.change.domain.enums.ChangeStatus;
import com.platform.core.change.domain.enums.ChangeType;
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
 * 变更请求实体（D37.16 P12 变更影响与闭环工作台）
 *
 * 状态机：
 * DRAFT → SUBMITTED → IMPACT_ASSESSMENT → PENDING_APPROVAL
 *      → APPROVED → IN_PROGRESS → PENDING_VERIFICATION → CLOSED
 *      ↓ (任意阶段) → REJECTED / RECALLED
 *
 * 安全红线（design-constraints.md §AI 安全红线）：
 *  - 高风险变更（CRITICAL）需 stepUpToken 二次认证
 *  - 批准人 ≠ 实施人 ≠ 关闭人（职责分离）
 *  - AI 辅助影响分析结果须人工确认
 *  - 关闭证据须可验证
 *
 * 表：change.change_request
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Entity(name = "ChangeRequest")
@Table(name = "change_request", schema = "change")
public class ChangeRequest extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 变更编号（业务可读，如 CHG-2026-001） */
    @Column(name = "code", nullable = false, unique = true, length = 64)
    private String code;

    /** 变更标题 */
    @Column(name = "title", nullable = false, length = 500)
    private String title;

    /** 变更描述/理由 */
    @Column(name = "description", length = 4000)
    private String description;

    /** 变更类型 */
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private ChangeType type;

    /** 变更优先级 */
    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 16)
    private ChangePriority priority;

    /** 变更状态 */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ChangeStatus status;

    /** 关联项目 ID */
    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    /** 关联 Baseline ID（可选） */
    @Column(name = "baseline_id", length = 64)
    private String baselineId;

    /** 发起人 ID（创建者） */
    @Column(name = "initiated_by", nullable = false, length = 200)
    private String initiatedBy;

    @Column(name = "initiated_at", nullable = false)
    private Instant initiatedAt;

    /** 批准人 ID（批准阶段填充） */
    @Column(name = "approved_by", length = 200)
    private String approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    /** 实施人 ID（实施阶段填充） */
    @Column(name = "implemented_by", length = 200)
    private String implementedBy;

    @Column(name = "implemented_at")
    private Instant implementedAt;

    /** 关闭人 ID（关闭阶段填充） */
    @Column(name = "closed_by", length = 200)
    private String closedBy;

    @Column(name = "closed_at")
    private Instant closedAt;

    /** 影响评估结论（JSON） */
    @Column(name = "impact_assessment", columnDefinition = "jsonb")
    private String impactAssessment = "{}";

    /** 是否已确认无影响（区分"尚未分析"与"确认无影响"） */
    @Column(name = "confirmed_no_impact", nullable = false)
    private boolean confirmedNoImpact;

    /** AI 辅助影响分析（V1 接入 LLM Provider） */
    @Column(name = "ai_assisted_analysis", columnDefinition = "jsonb")
    private String aiAssistedAnalysis = "{}";

    /** 是否 AI 辅助（前端展示标记） */
    @Column(name = "is_ai_assisted", nullable = false)
    private boolean aiAssisted;

    /** 风险等级评估说明 */
    @Column(name = "risk_assessment", length = 2000)
    private String riskAssessment;

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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public ChangeType getType() {
        return type;
    }

    public void setType(ChangeType type) {
        this.type = type;
    }

    public ChangePriority getPriority() {
        return priority;
    }

    public void setPriority(ChangePriority priority) {
        this.priority = priority;
    }

    public ChangeStatus getStatus() {
        return status;
    }

    public void setStatus(ChangeStatus status) {
        this.status = status;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getBaselineId() {
        return baselineId;
    }

    public void setBaselineId(String baselineId) {
        this.baselineId = baselineId;
    }

    public String getInitiatedBy() {
        return initiatedBy;
    }

    public void setInitiatedBy(String initiatedBy) {
        this.initiatedBy = initiatedBy;
    }

    public Instant getInitiatedAt() {
        return initiatedAt;
    }

    public void setInitiatedAt(Instant initiatedAt) {
        this.initiatedAt = initiatedAt;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(Instant approvedAt) {
        this.approvedAt = approvedAt;
    }

    public String getImplementedBy() {
        return implementedBy;
    }

    public void setImplementedBy(String implementedBy) {
        this.implementedBy = implementedBy;
    }

    public Instant getImplementedAt() {
        return implementedAt;
    }

    public void setImplementedAt(Instant implementedAt) {
        this.implementedAt = implementedAt;
    }

    public String getClosedBy() {
        return closedBy;
    }

    public void setClosedBy(String closedBy) {
        this.closedBy = closedBy;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(Instant closedAt) {
        this.closedAt = closedAt;
    }

    public String getImpactAssessment() {
        return impactAssessment;
    }

    public void setImpactAssessment(String impactAssessment) {
        this.impactAssessment = impactAssessment;
    }

    public boolean isConfirmedNoImpact() {
        return confirmedNoImpact;
    }

    public void setConfirmedNoImpact(boolean confirmedNoImpact) {
        this.confirmedNoImpact = confirmedNoImpact;
    }

    public String getAiAssistedAnalysis() {
        return aiAssistedAnalysis;
    }

    public void setAiAssistedAnalysis(String aiAssistedAnalysis) {
        this.aiAssistedAnalysis = aiAssistedAnalysis;
    }

    public boolean isAiAssisted() {
        return aiAssisted;
    }

    public void setAiAssisted(boolean aiAssisted) {
        this.aiAssisted = aiAssisted;
    }

    public String getRiskAssessment() {
        return riskAssessment;
    }

    public void setRiskAssessment(String riskAssessment) {
        this.riskAssessment = riskAssessment;
    }
}
