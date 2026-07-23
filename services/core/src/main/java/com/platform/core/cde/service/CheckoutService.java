package com.platform.core.cde.service;

import com.platform.core.cde.domain.Document;
import com.platform.core.cde.domain.DocumentStatus;
import com.platform.core.cde.domain.DocumentVersion;
import com.platform.core.cde.domain.DocumentVersionStatus;
import com.platform.core.cde.dto.CheckinRequest;
import com.platform.core.cde.dto.CheckoutDto;
import com.platform.core.cde.dto.DocumentVersionDto;
import com.platform.core.cde.dto.UploadVersionRequest;
import com.platform.core.cde.repository.DocumentRepository;
import com.platform.core.cde.support.CurrentUserResolver;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 检入检出应用服务
 * 管理文档状态流转：DRAFT/PUBLISHED → CHECKED_OUT → PUBLISHED
 *
 * <p>状态机：
 * <pre>
 *   DRAFT ──checkout──→ CHECKED_OUT ──checkin──→ PUBLISHED
 *   PUBLISHED ──checkout──→ CHECKED_OUT
 * </pre>
 *
 * <p>核心不变量：
 * <ul>
 *   <li>checkout：仅 DRAFT/PUBLISHED 可检出；CHECKED_OUT 不可重复检出</li>
 *   <li>checkin：仅 CHECKED_OUT 可检入；检入创建 PUBLISHED 版本并流转文档状态</li>
 *   <li>ARCHIVED/SUPERSEDED 不可检出或检入</li>
 * </ul>
 */
@Service
public class CheckoutService {

    private static final Logger log = LoggerFactory.getLogger(CheckoutService.class);

    private final DocumentRepository documentRepository;
    private final VersionService versionService;
    private final CurrentUserResolver currentUserResolver;

    public CheckoutService(DocumentRepository documentRepository,
                           VersionService versionService,
                           CurrentUserResolver currentUserResolver) {
        this.documentRepository = documentRepository;
        this.versionService = versionService;
        this.currentUserResolver = currentUserResolver;
    }

    /**
     * 检出文档
     * 业务规则：
     * 1. 文档必须存在且同租户
     * 2. 文档状态须为 DRAFT 或 PUBLISHED
     * 3. CHECKED_OUT 状态不可重复检出
     * 4. ARCHIVED/SUPERSEDED 不可检出
     *
     * @return 检出响应（含检出人与时间）
     */
    @Transactional
    public CheckoutDto checkout(UUID tenantId, UUID documentId) {
        Document document = loadDocumentOrThrow(tenantId, documentId);
        validateCheckoutable(document);

        UUID checkedOutBy = currentUserResolver.getCurrentPrincipalId();
        document.setStatus(DocumentStatus.CHECKED_OUT);
        documentRepository.save(document);

        log.info("检出文档成功 tenantId={} documentId={} checkedOutBy={}",
                tenantId, documentId, checkedOutBy);
        return new CheckoutDto(
                document.getId(),
                DocumentStatus.CHECKED_OUT,
                checkedOutBy,
                Instant.now()
        );
    }

    /**
     * 检入文档
     * 业务规则：
     * 1. 文档必须存在且同租户
     * 2. 文档状态须为 CHECKED_OUT
     * 3. 创建新版本（status=PUBLISHED），旧版本自动转为 SUPERSEDED
     * 4. 文档状态流转为 PUBLISHED，currentVersionId 更新为新版本
     *
     * @return 新创建的 PUBLISHED 版本
     */
    @Transactional
    public DocumentVersionDto checkin(UUID tenantId, UUID documentId, CheckinRequest request) {
        Document document = loadDocumentOrThrow(tenantId, documentId);
        validateCheckinable(document);

        UploadVersionRequest versionRequest = new UploadVersionRequest(
                request.storageKey(),
                request.checksum(),
                request.comment(),
                request.sizeBytes(),
                request.mimeType()
        );

        // 委托 VersionService 创建 PUBLISHED 版本（含旧版本 SUPERSEDED 标记）
        DocumentVersion version = versionService.createVersion(
                document, versionRequest, DocumentVersionStatus.PUBLISHED);

        // 文档状态流转为 PUBLISHED
        document.setStatus(DocumentStatus.PUBLISHED);
        documentRepository.save(document);

        log.info("检入文档成功 tenantId={} documentId={} versionId={} versionNumber={}",
                tenantId, documentId, version.getId(), version.getVersionNumber());
        return new DocumentVersionDto(
                version.getId(),
                version.getDocumentId(),
                version.getVersionNumber(),
                version.getUploadedBy(),
                version.getUploadedAt(),
                version.getComment(),
                version.getStorageKey(),
                version.getChecksum(),
                version.getStatus()
        );
    }

    // ── 内部辅助方法 ──

    private void validateCheckoutable(Document document) {
        String status = document.getStatus();
        if (DocumentStatus.CHECKED_OUT.equals(status)) {
            throw new BusinessException(ErrorCode.DOCUMENT_CHECKED_OUT,
                    "文档已被检出，无法重复检出");
        }
        if (DocumentStatus.ARCHIVED.equals(status) || DocumentStatus.SUPERSEDED.equals(status)) {
            throw new BusinessException(ErrorCode.INVALID_DOCUMENT_STATUS,
                    "当前状态不可检出: " + status);
        }
        if (!DocumentStatus.DRAFT.equals(status) && !DocumentStatus.PUBLISHED.equals(status)) {
            throw new BusinessException(ErrorCode.INVALID_DOCUMENT_STATUS,
                    "仅 DRAFT/PUBLISHED 状态可检出，当前状态: " + status);
        }
    }

    private void validateCheckinable(Document document) {
        String status = document.getStatus();
        if (!DocumentStatus.CHECKED_OUT.equals(status)) {
            throw new BusinessException(ErrorCode.DOCUMENT_NOT_CHECKED_OUT,
                    "文档未被检出，无法检入，当前状态: " + status);
        }
    }

    private Document loadDocumentOrThrow(UUID tenantId, UUID documentId) {
        return documentRepository.findByIdAndTenantId(documentId, tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DOCUMENT_NOT_FOUND,
                        "文档不存在: " + documentId));
    }
}
