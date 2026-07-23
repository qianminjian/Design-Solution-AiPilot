package com.platform.core.cde.domain;

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

import org.hibernate.annotations.Where;


import java.time.Instant;
import java.util.UUID;

/**
 * 文档实体（CDE 聚合根，V1 简化模型）
 * 对应表 cde.document，见 V5__init_cde_document.sql §1
 *
 * <p>核心不变量：
 * <ul>
 *   <li>租户 + 项目作用域</li>
 *   <li>软删除：deleted_at IS NULL 过滤</li>
 *   <li>状态流转：DRAFT → CHECKED_OUT → PUBLISHED → SUPERSEDED → ARCHIVED</li>
 *   <li>currentVersionId 指向当前生效版本</li>
 * </ul>
 *
 * <p>PII 分级：path 字段为 L5（业务核心设计文件），日志须脱敏
 */
@Entity
@Table(name = "document", schema = "cde")
@Where(clause = "deleted_at IS NULL")
public class Document extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 所属项目 ID */
    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    /** 文档名称 */
    @Column(name = "name", nullable = false)
    private String name;

    /** 文档路径（PII: L5 业务核心设计文件） */
    @Column(name = "path", nullable = false)
    private String path;

    /** MIME 类型 */
    @Column(name = "mime_type", nullable = false)
    private String mimeType;

    /** 文件大小（字节） */
    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes = 0L;

    /** 当前版本 ID（指向 cde.document_version.id） */
    @Column(name = "current_version_id")
    private UUID currentVersionId;

    /** 文档状态：DRAFT / CHECKED_OUT / PUBLISHED / SUPERSEDED / ARCHIVED */
    @Column(name = "status", nullable = false)
    private String status = "DRAFT";

    /** 当前版本内容校验和（SHA-256） */
    @Column(name = "checksum", length = 64)
    private String checksum;

    @Enumerated(EnumType.STRING)
    @Column(name = "classification", nullable = false)
    private DataClassification classification = DataClassification.PROJECT_RECORD;

    /** 元数据 JSONB（以字符串存储，默认 {}） */
    @Column(name = "metadata", nullable = false, columnDefinition = "jsonb")
    private String metadata = "{}";

    /** 软删除时间戳 */
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(Long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public UUID getCurrentVersionId() {
        return currentVersionId;
    }

    public void setCurrentVersionId(UUID currentVersionId) {
        this.currentVersionId = currentVersionId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getChecksum() {
        return checksum;
    }

    public void setChecksum(String checksum) {
        this.checksum = checksum;
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
