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
 * 工作流项目基线实体
 * 对应表 workflow.project_baseline，见 V6__init_workflow_stage_gate_baseline.sql §3
 *
 * <p>核心不变量：
 * <ul>
 *   <li>project_id + revision_no 唯一（仅未软删）</li>
 *   <li>revision_no 单调递增（冻结时取 max + 1）</li>
 *   <li>PUBLISHED 状态的基线可被门禁决策引用（冻结语义）</li>
 *   <li>软删除：deleted_at IS NULL 过滤</li>
 * </ul>
 *
 * <p>与 portfolio.ProjectBaseline 的区别：本实体操作 workflow schema 独立表，带软删除字段。
 */
@Entity
@Table(name = "project_baseline", schema = "workflow")
@Where(clause = "deleted_at IS NULL")
@SQLDelete(sql = "UPDATE workflow.project_baseline SET deleted_at = NOW(), deleted_by = NULL WHERE id = ?")
public class WorkflowProjectBaseline extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 所属项目 ID（外键引用 portfolio.project） */
    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    /** 修订号（项目内唯一，单调递增） */
    @Column(name = "revision_no", nullable = false)
    private Long revisionNo;

    @Column(name = "name", nullable = false)
    private String name;

    /** 修订状态：DRAFT / PUBLISHED / SUPERSEDED（PUBLISHED 即冻结可被引用） */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private WorkflowRevisionStatus status = WorkflowRevisionStatus.DRAFT;

    /** 冻结时间（status 切换为 PUBLISHED 时设置） */
    @Column(name = "frozen_at")
    private Instant frozenAt;

    /** 冻结执行人 */
    @Column(name = "frozen_by")
    private UUID frozenBy;

    @Column(name = "description")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "classification", nullable = false)
    private DataClassification classification = DataClassification.PUBLISHED_EVIDENCE;

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

    public Long getRevisionNo() {
        return revisionNo;
    }

    public void setRevisionNo(Long revisionNo) {
        this.revisionNo = revisionNo;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public WorkflowRevisionStatus getStatus() {
        return status;
    }

    public void setStatus(WorkflowRevisionStatus status) {
        this.status = status;
    }

    public Instant getFrozenAt() {
        return frozenAt;
    }

    public void setFrozenAt(Instant frozenAt) {
        this.frozenAt = frozenAt;
    }

    public UUID getFrozenBy() {
        return frozenBy;
    }

    public void setFrozenBy(UUID frozenBy) {
        this.frozenBy = frozenBy;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public DataClassification getClassification() {
        return classification;
    }

    public void setClassification(DataClassification classification) {
        this.classification = classification;
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
