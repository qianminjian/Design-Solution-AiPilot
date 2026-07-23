package com.platform.core.cde.service;

import com.platform.core.cde.domain.Document;
import com.platform.core.cde.domain.DocumentStatus;
import com.platform.core.cde.domain.DocumentVersion;
import com.platform.core.cde.domain.DocumentVersionStatus;
import com.platform.core.cde.dto.DocumentVersionDto;
import com.platform.core.cde.dto.UploadVersionRequest;
import com.platform.core.cde.repository.DocumentRepository;
import com.platform.core.cde.repository.DocumentVersionRepository;
import com.platform.core.cde.support.CurrentUserResolver;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.domain.DataClassification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 文档版本应用服务
 * 涵盖版本上传（自动递增 versionNumber + 旧版本 SUPERSEDED）、列表与详情查询
 *
 * <p>核心不变量：
 * <ul>
 *   <li>同文档内 version_number 单调递增且唯一</li>
 *   <li>新版本上传后旧版本自动转为 SUPERSEDED</li>
 *   <li>版本 storageKey/checksum 创建后不可修改（不可变修订模型）</li>
 *   <li>文档 currentVersionId 始终指向最新版本</li>
 * </ul>
 *
 * <p>CheckoutService.checkin 委托本类创建 PUBLISHED 版本（见 {@link #createVersion})
 */
@Service
public class VersionService {

    private static final Logger log = LoggerFactory.getLogger(VersionService.class);

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final CurrentUserResolver currentUserResolver;

    public VersionService(DocumentRepository documentRepository,
                          DocumentVersionRepository versionRepository,
                          CurrentUserResolver currentUserResolver) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.currentUserResolver = currentUserResolver;
    }

    /**
     * 上传新版本（DRAFT 状态）
     * 业务规则：
     * 1. 文档必须存在且同租户
     * 2. 文档不可为 CHECKED_OUT / ARCHIVED 状态
     * 3. version_number 自动递增（max + 1）
     * 4. 旧版本状态自动转为 SUPERSEDED
     * 5. 更新 document.currentVersionId / checksum / sizeBytes / mimeType
     */
    @Transactional
    public DocumentVersionDto uploadVersion(UUID tenantId, UUID documentId, UploadVersionRequest request) {
        Document document = loadDocumentOrThrow(tenantId, documentId);
        validateUploadable(document);

        DocumentVersion version = createVersion(document, request, DocumentVersionStatus.DRAFT);
        documentRepository.save(document);
        log.info("上传文档版本成功 tenantId={} documentId={} versionId={} versionNumber={}",
                tenantId, documentId, version.getId(), version.getVersionNumber());
        return toDto(version);
    }

    /**
     * 查询文档所有版本（按 version_number 降序）
     */
    @Transactional(readOnly = true)
    public List<DocumentVersionDto> listVersions(UUID tenantId, UUID documentId) {
        loadDocumentOrThrow(tenantId, documentId);
        return versionRepository.findByDocumentIdAndTenantIdOrderByVersionNumberDesc(documentId, tenantId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * 查询单个版本详情
     */
    @Transactional(readOnly = true)
    public DocumentVersionDto getVersion(UUID tenantId, UUID documentId, UUID versionId) {
        loadDocumentOrThrow(tenantId, documentId);
        DocumentVersion version = versionRepository.findByIdAndTenantId(versionId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VERSION_NOT_FOUND,
                        "文档版本不存在: " + versionId));
        if (!documentId.equals(version.getDocumentId())) {
            throw new BusinessException(ErrorCode.VERSION_NOT_FOUND,
                    "版本不属于指定文档: " + versionId);
        }
        return toDto(version);
    }

    /**
     * 创建版本并更新文档引用（包级可见，供 CheckoutService.checkin 复用）
     *
     * <p>调用方负责：
     * <ul>
     *   <li>加载并校验文档状态</li>
     *   <li>调用后保存文档（本方法仅修改内存对象，不持久化文档）</li>
     * </ul>
     *
     * @param document 目标文档（已加载，调用方负责保存）
     * @param request  上传请求
     * @param status   版本初始状态（DRAFT 或 PUBLISHED）
     * @return 已持久化的版本实体
     */
    DocumentVersion createVersion(Document document, UploadVersionRequest request, String status) {
        Integer maxVersion = versionRepository.findMaxVersionNumber(document.getId());
        int nextVersionNumber = (maxVersion == null ? 0 : maxVersion) + 1;

        DocumentVersion version = buildVersion(document, request, nextVersionNumber, status);
        DocumentVersion saved = versionRepository.save(version);

        // 旧版本状态转为 SUPERSEDED（排除刚创建的新版本）
        versionRepository.markPreviousVersionsSuperseded(document.getId(), saved.getId());

        // 更新文档引用至新版本
        document.setCurrentVersionId(saved.getId());
        document.setChecksum(saved.getChecksum());
        document.setSizeBytes(saved.getFileSize());
        if (saved.getMimeType() != null) {
            document.setMimeType(saved.getMimeType());
        }
        return saved;
    }

    // ── 内部辅助方法 ──

    private void validateUploadable(Document document) {
        String status = document.getStatus();
        if (DocumentStatus.CHECKED_OUT.equals(status)) {
            throw new BusinessException(ErrorCode.DOCUMENT_CHECKED_OUT,
                    "文档已检出，无法上传新版本");
        }
        if (DocumentStatus.ARCHIVED.equals(status)) {
            throw new BusinessException(ErrorCode.INVALID_DOCUMENT_STATUS,
                    "已归档文档不可上传新版本");
        }
    }

    private DocumentVersion buildVersion(Document document, UploadVersionRequest request,
                                         int versionNumber, String status) {
        DocumentVersion version = new DocumentVersion();
        version.setTenantId(document.getTenantId());
        version.setProjectId(document.getProjectId());
        version.setDocumentId(document.getId());
        version.setVersionNumber(versionNumber);
        version.setUploadedBy(currentUserResolver.getCurrentPrincipalId());
        version.setUploadedAt(Instant.now());
        version.setComment(request.comment());
        version.setStorageKey(request.storageKey());
        version.setChecksum(request.checksum());
        version.setStatus(status);
        version.setFileSize(request.sizeBytes() != null ? request.sizeBytes() : 0L);
        version.setMimeType(request.mimeType());
        version.setClassification(DataClassification.PROJECT_RECORD);
        version.setMetadata("{}");
        return version;
    }

    private Document loadDocumentOrThrow(UUID tenantId, UUID documentId) {
        return documentRepository.findByIdAndTenantId(documentId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DOCUMENT_NOT_FOUND,
                        "文档不存在: " + documentId));
    }

    private DocumentVersionDto toDto(DocumentVersion v) {
        return new DocumentVersionDto(
                v.getId(),
                v.getDocumentId(),
                v.getVersionNumber(),
                v.getUploadedBy(),
                v.getUploadedAt(),
                v.getComment(),
                v.getStorageKey(),
                v.getChecksum(),
                v.getStatus()
        );
    }
}
