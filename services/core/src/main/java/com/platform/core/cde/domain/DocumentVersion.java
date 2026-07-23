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



import java.time.Instant;
import java.util.UUID;

/**
 * 文档版本实体（不可变修订模型）
 * 对应表 cde.document_version，见 V5__init_cde_document.sql §2
 *
 * <p>核心不变量：
 * <ul>
 *   <li>同文档内 version_number 单调递增且唯一</li>
 *   <li>storageKey/checksum 创建后不可修改（不可变修订）</li>
 *   <li>状态流转：DRAFT → PUBLISHED → SUPERSEDED</li>
 *   <li>新版本上传后旧版本自动转为 SUPERSEDED</li>
 * </ul>
 */
@Entity
@Table(name = "document_version", schema = "cde")
public class DocumentVersion extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 所属项目 ID（冗余，便于租户+项目级查询） */
    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    /** 所属文档 ID */
    @Column(name = "document_id", nullable = false, updatable = false)
    private UUID documentId;

    /** 版本号，同文档内单调递增（从 1 开始） */
    @Column(name = "version_number", nullable = false, updatable = false)
    private Integer versionNumber;

    /** 上传人 ID */
    @Column(name = "uploaded_by")
    private UUID uploadedBy;

    /** 上传时间 */
    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt;

    /** 版本说明 */
    @Column(name = "comment")
    private String comment;

    /** 对象存储 Key（S3/MinIO 引用，不可变） */
    @Column(name = "storage_key", nullable = false, updatable = false)
    private String storageKey;

    /** 版本内容校验和（SHA-256，不可变） */
    @Column(name = "checksum", nullable = false, updatable = false, length = 64)
    private String checksum;

    /** 版本状态：DRAFT / PUBLISHED / SUPERSEDED */
    @Column(name = "status", nullable = false)
    private String status = "DRAFT";

    /** 文件大小（字节） */
    @Column(name = "file_size", nullable = false)
    private Long fileSize = 0L;

    /** MIME 类型 */
    @Column(name = "mime_type", length = 200)
    private String mimeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "classification", nullable = false)
    private DataClassification classification = DataClassification.PROJECT_RECORD;

    /** 元数据 JSONB */
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

    public UUID getDocumentId() {
        return documentId;
    }

    public void setDocumentId(UUID documentId) {
        this.documentId = documentId;
    }

    public Integer getVersionNumber() {
        return versionNumber;
    }

    public void setVersionNumber(Integer versionNumber) {
        this.versionNumber = versionNumber;
    }

    public UUID getUploadedBy() {
        return uploadedBy;
    }

    public void setUploadedBy(UUID uploadedBy) {
        this.uploadedBy = uploadedBy;
    }

    public Instant getUploadedAt() {
        return uploadedAt;
    }

    public void setUploadedAt(Instant uploadedAt) {
        this.uploadedAt = uploadedAt;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public void setStorageKey(String storageKey) {
        this.storageKey = storageKey;
    }

    public String getChecksum() {
        return checksum;
    }

    public void setChecksum(String checksum) {
        this.checksum = checksum;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
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
