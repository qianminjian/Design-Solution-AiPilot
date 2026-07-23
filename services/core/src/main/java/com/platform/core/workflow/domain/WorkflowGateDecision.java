package com.platform.core.workflow.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.iam.domain.DataClassification;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;


import java.time.Instant;
import java.util.UUID;

/**
 * 工作流门禁决策实体
 * 对应表 workflow.gate_decision，见 V6__init_workflow_stage_gate_baseline.sql §2
 *
 * <p>核心不变量：
 * <ul>
 *   <li>引用的 baseline_id 必须为 PUBLISHED（已冻结）状态</li>
 *   <li>决策后 status 由 PENDING 转为 DECIDED</li>
 *   <li>软删除：deleted_at IS NULL 过滤</li>
 * </ul>
 *
 * <p>与 portfolio.GateDecision 的区别：本实体操作 workflow schema 独立表，带软删除字段。
 */
@Entity
@Table(name = "gate_decision", schema = "workflow")
@Where(clause = "deleted_at IS NULL")
@SQLDelete(sql = "UPDATE workflow.gate_decision SET deleted_at = NOW(), deleted_by = NULL WHERE id = ?")
public class WorkflowGateDecision extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 所属项目 ID（外键引用 portfolio.project） */
    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    /** 关联阶段 ID（可空，引用 workflow.stage_instance） */
    @Column(name = "stage_id")
    private UUID stageId;

    /** 门禁编码：G0 ~ G8 */
    @Column(name = "gate_code", nullable = false)
    private String gateCode;

    /** 门禁名称 */
    @Column(name = "gate_name", nullable = false)
    private String gateName;

    /** 门禁状态：PENDING / DECIDED / CANCELLED */
    @Column(name = "status", nullable = false)
    private String status = "PENDING";

    /** 决策结论：APPROVED / CONDITIONALLY_APPROVED / REWORK_REQUIRED / SUSPENDED / CANCELLED */
    @Column(name = "decision")
    private String decision;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "decided_by")
    private UUID decidedBy;

    /** 关联基线 ID（必须为 PUBLISHED 状态，核心不变量） */
    @Column(name = "baseline_id")
    private UUID baselineId;

    @Column(name = "comment")
    private String comment;

    @Enumerated(EnumType.STRING)
    @Column(name = "classification", nullable = false)
    private DataClassification classification = DataClassification.PUBLISHED_EVIDENCE;

    /** 证据 JSONB 数组（以字符串存储，默认 []） */
    @Column(name = "evidence", nullable = false, columnDefinition = "jsonb")
    private String evidence = "[]";

    /** 元数据 JSONB（以字符串存储，默认 {}） */
    @Column(name = "metadata", nullable = false, columnDefinition = "jsonb")
    private String metadata = "{}";

    /** 软删除时间戳（@Where 过滤） */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** 软删除执行人 */
    @Column(name = "deleted_by")
    private UUID deletedBy;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public void setProjectId(UUID projectId) {
        this.projectId = projectId;
    }

    public UUID getStageId() {
        return stageId;
    }

    public void setStageId(UUID stageId) {
        this.stageId = stageId;
    }

    public String getGateCode() {
        return gateCode;
    }

    public void setGateCode(String gateCode) {
        this.gateCode = gateCode;
    }

    public String getGateName() {
        return gateName;
    }

    public void setGateName(String gateName) {
        this.gateName = gateName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDecision() {
        return decision;
    }

    public void setDecision(String decision) {
        this.decision = decision;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(Instant decidedAt) {
        this.decidedAt = decidedAt;
    }

    public UUID getDecidedBy() {
        return decidedBy;
    }

    public void setDecidedBy(UUID decidedBy) {
        this.decidedBy = decidedBy;
    }

    public UUID getBaselineId() {
        return baselineId;
    }

    public void setBaselineId(UUID baselineId) {
        this.baselineId = baselineId;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public DataClassification getClassification() {
        return classification;
    }

    public void setClassification(DataClassification classification) {
        this.classification = classification;
    }

    public String getEvidence() {
        return evidence;
    }

    public void setEvidence(String evidence) {
        this.evidence = evidence;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }

    public UUID getDeletedBy() {
        return deletedBy;
    }

    public void setDeletedBy(UUID deletedBy) {
        this.deletedBy = deletedBy;
    }
}
