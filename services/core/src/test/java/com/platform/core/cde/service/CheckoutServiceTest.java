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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * CheckoutService 单元测试
 *
 * <p>覆盖核心业务规则：
 * <ul>
 *   <li>检出：DRAFT/PUBLISHED 可检出；CHECKED_OUT 不可重复；ARCHIVED/SUPERSEDED 不可检出</li>
 *   <li>检入：仅 CHECKED_OUT 可检入；创建新版本并将文档状态流转为 PUBLISHED</li>
 *   <li>文档不存在异常</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class CheckoutServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private VersionService versionService;

    @Mock
    private CurrentUserResolver currentUserResolver;

    @Captor
    private ArgumentCaptor<Document> documentCaptor;

    private CheckoutService service;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID documentId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID userId = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private final UUID versionId = UUID.fromString("44444444-4444-4444-4444-444444444444");

    @BeforeEach
    void setUp() {
        service = new CheckoutService(documentRepository, versionService, currentUserResolver);
    }

    @Nested
    @DisplayName("检出文档")
    class Checkout {

        @Test
        @DisplayName("应该成功检出 PUBLISHED 文档并设置 CHECKED_OUT 状态")
        void shouldCheckoutPublishedDocument() {
            Document document = buildDocument(documentId, tenantId, DocumentStatus.PUBLISHED);
            when(documentRepository.findByIdAndTenantId(documentId, tenantId))
                    .thenReturn(Optional.of(document));
            when(currentUserResolver.getCurrentPrincipalId()).thenReturn(userId);

            CheckoutDto dto = service.checkout(tenantId, documentId);

            assertThat(dto.documentId()).isEqualTo(documentId);
            assertThat(dto.status()).isEqualTo(DocumentStatus.CHECKED_OUT);
            assertThat(dto.checkedOutBy()).isEqualTo(userId);
            assertThat(dto.checkedOutAt()).isNotNull();

            verify(documentRepository).save(documentCaptor.capture());
            assertThat(documentCaptor.getValue().getStatus()).isEqualTo(DocumentStatus.CHECKED_OUT);
        }

        @Test
        @DisplayName("应该成功检出 DRAFT 文档")
        void shouldCheckoutDraftDocument() {
            Document document = buildDocument(documentId, tenantId, DocumentStatus.DRAFT);
            when(documentRepository.findByIdAndTenantId(documentId, tenantId))
                    .thenReturn(Optional.of(document));
            when(currentUserResolver.getCurrentPrincipalId()).thenReturn(userId);

            CheckoutDto dto = service.checkout(tenantId, documentId);

            assertThat(dto.status()).isEqualTo(DocumentStatus.CHECKED_OUT);
        }

        @Test
        @DisplayName("应该在文档不存在时抛出 DOCUMENT_NOT_FOUND 异常")
        void shouldThrowWhenDocumentNotFound() {
            when(documentRepository.findByIdAndTenantId(documentId, tenantId))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.checkout(tenantId, documentId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.DOCUMENT_NOT_FOUND);
        }

        @Test
        @DisplayName("应该在文档已被检出时抛出 DOCUMENT_CHECKED_OUT 异常")
        void shouldThrowWhenDocumentAlreadyCheckedOut() {
            Document document = buildDocument(documentId, tenantId, DocumentStatus.CHECKED_OUT);
            when(documentRepository.findByIdAndTenantId(documentId, tenantId))
                    .thenReturn(Optional.of(document));

            assertThatThrownBy(() -> service.checkout(tenantId, documentId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.DOCUMENT_CHECKED_OUT);
        }

        @Test
        @DisplayName("应该在文档已归档时抛出 INVALID_DOCUMENT_STATUS 异常")
        void shouldThrowWhenDocumentArchived() {
            Document document = buildDocument(documentId, tenantId, DocumentStatus.ARCHIVED);
            when(documentRepository.findByIdAndTenantId(documentId, tenantId))
                    .thenReturn(Optional.of(document));

            assertThatThrownBy(() -> service.checkout(tenantId, documentId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_DOCUMENT_STATUS);
        }

        @Test
        @DisplayName("应该在文档状态为 SUPERSEDED 时抛出 INVALID_DOCUMENT_STATUS 异常")
        void shouldThrowWhenDocumentSuperseded() {
            Document document = buildDocument(documentId, tenantId, DocumentStatus.SUPERSEDED);
            when(documentRepository.findByIdAndTenantId(documentId, tenantId))
                    .thenReturn(Optional.of(document));

            assertThatThrownBy(() -> service.checkout(tenantId, documentId))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_DOCUMENT_STATUS);
        }
    }

    @Nested
    @DisplayName("检入文档")
    class Checkin {

        @Test
        @DisplayName("应该成功检入 CHECKED_OUT 文档并流转为 PUBLISHED")
        void shouldCheckinCheckedOutDocument() {
            Document document = buildDocument(documentId, tenantId, DocumentStatus.CHECKED_OUT);
            when(documentRepository.findByIdAndTenantId(documentId, tenantId))
                    .thenReturn(Optional.of(document));

            DocumentVersion newVersion = buildVersion(versionId, documentId, 2, DocumentVersionStatus.PUBLISHED);
            when(versionService.createVersion(
                    eq(document), any(UploadVersionRequest.class), eq(DocumentVersionStatus.PUBLISHED)))
                    .thenReturn(newVersion);

            CheckinRequest request = new CheckinRequest(
                    "检入说明",
                    "s3://bucket/file-v2.rvt",
                    "a".repeat(64),
                    1024L,
                    "application/octet-stream");

            DocumentVersionDto dto = service.checkin(tenantId, documentId, request);

            assertThat(dto.id()).isEqualTo(versionId);
            assertThat(dto.versionNumber()).isEqualTo(2);
            assertThat(dto.status()).isEqualTo(DocumentVersionStatus.PUBLISHED);

            verify(documentRepository).save(documentCaptor.capture());
            assertThat(documentCaptor.getValue().getStatus()).isEqualTo(DocumentStatus.PUBLISHED);
        }

        @Test
        @DisplayName("应该在文档未检出时抛出 DOCUMENT_NOT_CHECKED_OUT 异常")
        void shouldThrowWhenDocumentNotCheckedOut() {
            Document document = buildDocument(documentId, tenantId, DocumentStatus.PUBLISHED);
            when(documentRepository.findByIdAndTenantId(documentId, tenantId))
                    .thenReturn(Optional.of(document));

            CheckinRequest request = new CheckinRequest(
                    "说明", "s3://bucket/file.rvt", "a".repeat(64), 100L, "application/octet-stream");

            assertThatThrownBy(() -> service.checkin(tenantId, documentId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.DOCUMENT_NOT_CHECKED_OUT);
        }

        @Test
        @DisplayName("应该在文档不存在时抛出 DOCUMENT_NOT_FOUND 异常")
        void shouldThrowWhenDocumentNotFound() {
            when(documentRepository.findByIdAndTenantId(documentId, tenantId))
                    .thenReturn(Optional.empty());

            CheckinRequest request = new CheckinRequest(
                    "说明", "s3://bucket/file.rvt", "a".repeat(64), 100L, "application/octet-stream");

            assertThatThrownBy(() -> service.checkin(tenantId, documentId, request))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.DOCUMENT_NOT_FOUND);
        }
    }

    // ── 辅助方法 ──

    private Document buildDocument(UUID id, UUID tenantId, String status) {
        Document d = new Document();
        d.setId(id);
        d.setTenantId(tenantId);
        d.setProjectId(UUID.randomUUID());
        d.setName("设计文档");
        d.setPath("/projects/p1/docs/file.rvt");
        d.setMimeType("application/octet-stream");
        d.setStatus(status);
        return d;
    }

    private DocumentVersion buildVersion(UUID id, UUID documentId, int versionNumber, String status) {
        DocumentVersion v = new DocumentVersion();
        v.setId(id);
        v.setDocumentId(documentId);
        v.setVersionNumber(versionNumber);
        v.setStatus(status);
        v.setStorageKey("s3://bucket/file-v" + versionNumber + ".rvt");
        return v;
    }
}
