package com.platform.core.cde.service;

import com.platform.core.cde.domain.Document;
import com.platform.core.cde.domain.DocumentStatus;
import com.platform.core.cde.domain.DocumentVersion;
import com.platform.core.cde.domain.DocumentVersionStatus;
import com.platform.core.cde.dto.CreateDocumentRequest;
import com.platform.core.cde.dto.DocumentDto;
import com.platform.core.cde.dto.ListDocumentsRequest;
import com.platform.core.cde.dto.UpdateDocumentRequest;
import com.platform.core.cde.repository.DocumentRepository;
import com.platform.core.cde.repository.DocumentVersionRepository;
import com.platform.core.cde.support.CurrentUserResolver;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.domain.DataClassification;
import com.platform.core.portfolio.repository.ProjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 文档应用服务（CDE 聚合根）
 * 涵盖文档 CRUD、软删除与初始版本创建
 *
 * <p>核心不变量：
 * <ul>
 *   <li>租户 + 项目作用域隔离</li>
 *   <li>创建文档时自动创建初始版本 v1（status=DRAFT）</li>
 *   <li>软删除：仅 DRAFT 状态可删除（PUBLISHED 须先归档）</li>
 *   <li>租户隔离：所有查询带 tenant_id</li>
 * </ul>
 *
 * <p>PII 分级：path 字段为 L5（业务核心设计文件），日志须脱敏
 */
@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final ProjectRepository projectRepository;
    private final CurrentUserResolver currentUserResolver;

    public DocumentService(DocumentRepository documentRepository,
                           DocumentVersionRepository versionRepository,
                           ProjectRepository projectRepository,
                           CurrentUserResolver currentUserResolver) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.projectRepository = projectRepository;
        this.currentUserResolver = currentUserResolver;
    }

    /**
     * 创建文档
     * 业务规则：
     * 1. 项目必须存在且同租户
     * 2. 自动创建初始版本 v1（status=DRAFT）
     * 3. 文档 currentVersionId 指向 v1
     */
    @Transactional
    public DocumentDto createDocument(UUID tenantId, UUID projectId, CreateDocumentRequest request) {
        validateProjectExists(tenantId, projectId);

        Document document = buildDocument(tenantId, projectId, request);
        Document saved = documentRepository.save(document);

        DocumentVersion initialVersion = createInitialVersion(tenantId, projectId, saved.getId(), request);
        DocumentVersion savedVersion = versionRepository.save(initialVersion);

        saved.setCurrentVersionId(savedVersion.getId());
        saved.setChecksum(savedVersion.getChecksum());
        Document updated = documentRepository.save(saved);

        log.info("创建文档成功 tenantId={} projectId={} documentId={} versionId={}",
                tenantId, projectId, updated.getId(), savedVersion.getId());
        return toDto(updated);
    }

    /**
     * 查询文档详情
     */
    @Transactional(readOnly = true)
    public DocumentDto getDocument(UUID tenantId, UUID documentId) {
        return toDto(loadDocumentOrThrow(tenantId, documentId));
    }

    /**
     * 分页查询项目下文档（支持状态过滤与名称模糊查询）
     */
    @Transactional(readOnly = true)
    public Page<DocumentDto> listDocuments(UUID tenantId, UUID projectId,
                                           ListDocumentsRequest request, Pageable pageable) {
        Page<Document> page = queryDocuments(tenantId, projectId, request, pageable);
        return page.map(this::toDto);
    }

    /**
     * 部分更新文档元数据（status 通过 checkout/checkin 流转，不在此处修改）
     */
    @Transactional
    public DocumentDto updateDocument(UUID tenantId, UUID documentId, UpdateDocumentRequest request) {
        Document document = loadDocumentOrThrow(tenantId, documentId);
        validateNotArchived(document);
        applyUpdate(document, request);
        Document saved = documentRepository.save(document);
        log.info("更新文档成功 tenantId={} documentId={}", tenantId, documentId);
        return toDto(saved);
    }

    /**
     * 软删除文档
     * 业务规则：仅 DRAFT 状态可删除；PUBLISHED/CHECKED_OUT 须先归档或检入
     */
    @Transactional
    public void deleteDocument(UUID tenantId, UUID documentId) {
        Document document = loadDocumentOrThrow(tenantId, documentId);
        validateDeletable(document);

        document.setDeletedAt(Instant.now());
        document.setDeletedBy(currentUserResolver.getCurrentPrincipalId());
        documentRepository.save(document);
        log.info("软删除文档成功 tenantId={} documentId={}", tenantId, documentId);
    }

    // ── 内部辅助方法 ──

    private void validateProjectExists(UUID tenantId, UUID projectId) {
        projectRepository.findByIdAndTenantId(projectId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PROJECT_NOT_FOUND,
                        "项目不存在: " + projectId));
    }

    private void validateNotArchived(Document document) {
        if (DocumentStatus.ARCHIVED.equals(document.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_DOCUMENT_STATUS,
                    "已归档文档不可修改");
        }
    }

    private void validateDeletable(Document document) {
        if (!DocumentStatus.DRAFT.equals(document.getStatus())) {
            throw new BusinessException(ErrorCode.INVALID_DOCUMENT_STATUS,
                    "仅 DRAFT 状态文档可删除，当前状态: " + document.getStatus());
        }
    }

    private Document buildDocument(UUID tenantId, UUID projectId, CreateDocumentRequest request) {
        Document document = new Document();
        document.setTenantId(tenantId);
        document.setProjectId(projectId);
        document.setName(request.name());
        document.setPath(request.path());
        document.setMimeType(request.mimeType());
        document.setSizeBytes(request.sizeBytes() != null ? request.sizeBytes() : 0L);
        document.setStatus(DocumentStatus.DRAFT);
        document.setChecksum(request.checksum());
        document.setClassification(DataClassification.PROJECT_RECORD);
        document.setMetadata("{}");
        return document;
    }

    private DocumentVersion createInitialVersion(UUID tenantId, UUID projectId,
                                                 UUID documentId, CreateDocumentRequest request) {
        DocumentVersion version = new DocumentVersion();
        version.setTenantId(tenantId);
        version.setProjectId(projectId);
        version.setDocumentId(documentId);
        version.setVersionNumber(1);
        version.setUploadedBy(currentUserResolver.getCurrentPrincipalId());
        version.setUploadedAt(Instant.now());
        version.setComment(request.comment());
        version.setStorageKey(request.storageKey());
        version.setChecksum(request.checksum());
        version.setStatus(DocumentVersionStatus.DRAFT);
        version.setFileSize(request.sizeBytes() != null ? request.sizeBytes() : 0L);
        version.setMimeType(request.mimeType());
        version.setClassification(DataClassification.PROJECT_RECORD);
        version.setMetadata("{}");
        return version;
    }

    private Page<Document> queryDocuments(UUID tenantId, UUID projectId,
                                          ListDocumentsRequest request, Pageable pageable) {
        boolean hasStatus = request.status() != null && !request.status().isBlank();
        boolean hasKeyword = request.keyword() != null && !request.keyword().isBlank();
        if (hasKeyword) {
            return documentRepository.findByTenantIdAndProjectIdAndNameContainingIgnoreCaseAndDeletedAtIsNull(
                    tenantId, projectId, request.keyword(), pageable);
        }
        if (hasStatus) {
            return documentRepository.findByTenantIdAndProjectIdAndStatusAndDeletedAtIsNull(
                    tenantId, projectId, request.status(), pageable);
        }
        return documentRepository.findByTenantIdAndProjectIdAndDeletedAtIsNull(
                tenantId, projectId, pageable);
    }

    private void applyUpdate(Document document, UpdateDocumentRequest request) {
        if (request.name() != null) {
            document.setName(request.name());
        }
        if (request.path() != null) {
            document.setPath(request.path());
        }
        if (request.mimeType() != null) {
            document.setMimeType(request.mimeType());
        }
    }

    /**
     * 加载文档（带租户校验，防越权）
     */
    private Document loadDocumentOrThrow(UUID tenantId, UUID documentId) {
        return documentRepository.findByIdAndTenantId(documentId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DOCUMENT_NOT_FOUND,
                        "文档不存在: " + documentId));
    }

    private DocumentDto toDto(Document d) {
        return new DocumentDto(
                d.getId(),
                d.getTenantId(),
                d.getProjectId(),
                d.getName(),
                d.getPath(),
                d.getMimeType(),
                d.getSizeBytes(),
                d.getCurrentVersionId(),
                d.getStatus(),
                d.getChecksum(),
                d.getCreatedBy(),
                d.getCreatedAt(),
                d.getUpdatedAt(),
                d.getRowVersion()
        );
    }
}
