package com.platform.core.workflow.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import com.platform.core.iam.domain.DataClassification;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;
import org.hibernate.id.uuid.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

/**
 * 工作流阶段实例实体
 * 对应表 workflow.stage_instance，见 V6__init_workflow_stage_gate_baseline.sql §1
 *
 * <p>核心不变量：
 * <ul>
 *   <li>project_id + stage_order 唯一（仅未软删）</li>
 *   <li>状态流转遵循 D05.4.1 状态机（见 portfolio.support.StageDefinitions）</li>
 *   <li>软删除：deleted_at IS NULL 过滤</li>
 * </ul>
 *
 * <p>与 portfolio.StageInstance 的区别：本实体操作 workflow schema 独立表，带软删除字段。
 */
@Entity
@Table(name = "stage_instance", schema = "workflow")
@Where(clause = "deleted_at IS NULL")
@SQLDelete(sql = "UPDATE workflow.stage_instance SET deleted_at = NOW(), deleted_by = NULL WHERE id = ?")
@GenericGenerator(name = "uuid_v7", type = UuidGenerator.class)
public class StageInstance extends TenantBaseEntity {

    @Id
    @GeneratedValue(generator = "uuid_v7")
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 所属项目 ID（外键引用 portfolio.project） */
    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    /** 阶段编码：STG-P0 ~ STG-P8 */
    @Column(name = "stage_code", nullable = false)
    private String stageCode;

    /** 阶段名称 */
    @Column(name = "stage_name", nullable = false)
    private String stageName;

    /** 阶段顺序（项目内唯一，仅未软删） */
    @Column(name = "stage_order", nullable = false)
    private Integer stageOrder;

    /** 阶段状态：NOT_STARTED / PLANNED / ACTIVE / REVIEW_PREPARING / UNDER_REVIEW 等 */
    @Column(name = "status", nullable = false)
    private String status = "NOT_STARTED";

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "classification", nullable = false)
    private DataClassification classification = DataClassification.PROJECT_RECORD;

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

    public String getStageCode() {
        return stageCode;
    }

    public void setStageCode(String stageCode) {
        this.stageCode = stageCode;
    }

    public String getStageName() {
        return stageName;
    }

    public void setStageName(String stageName) {
        this.stageName = stageName;
    }

    public Integer getStageOrder() {
        return stageOrder;
    }

    public void setStageOrder(Integer stageOrder) {
        this.stageOrder = stageOrder;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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
