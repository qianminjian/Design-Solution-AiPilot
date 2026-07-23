package com.platform.core.iam.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.Where;


import com.platform.core.common.entity.TenantBaseEntity;

import java.time.Instant;
import java.util.UUID;

/**
 * 组织实体（自引用层级结构）
 */
@Entity
@Table(name = "organization", schema = "iam")
@Where(clause = "deleted_at IS NULL")
public class Organization extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    /** 类型：COMPANY / DEPARTMENT / TEAM / EXTERNAL */
    @Column(name = "type", nullable = false)
    private String type = "COMPANY";

    /** 父组织 ID（自引用，允许为 null 表示顶层） */
    @Column(name = "parent_id")
    private UUID parentId;

    /** 状态：ACTIVE / ARCHIVED */
    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    @Enumerated(EnumType.STRING)
    @Column(name = "classification", nullable = false)
    private DataClassification classification = DataClassification.PROJECT_RECORD;

    @Column(name = "metadata", nullable = false, columnDefinition = "jsonb")
    private String metadata = "{}";

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "deleted_by")
    private UUID deletedBy;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public UUID getParentId() {
        return parentId;
    }

    public void setParentId(UUID parentId) {
        this.parentId = parentId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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
