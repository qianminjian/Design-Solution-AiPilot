package com.platform.core.portfolio.domain;

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



import java.time.Instant;
import java.util.UUID;

/**
 * 项目基线实体
 * 对应表 portfolio.project_baseline，见 V2__init_portfolio_requirement.sql §1.4
 *
 * <p>核心不变量：
 * <ul>
 *   <li>project_id + revision_no 唯一</li>
 *   <li>revision_no 单调递增（冻结时取 max + 1）</li>
 *   <li>PUBLISHED 状态的基线可被门禁决策引用（冻结语义）</li>
 * </ul>
 */
@Entity
@Table(name = "project_baseline", schema = "portfolio")
public class ProjectBaseline extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 所属项目 ID */
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
    private RevisionStatus status = RevisionStatus.DRAFT;

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

    public RevisionStatus getStatus() {
        return status;
    }

    public void setStatus(RevisionStatus status) {
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
}
