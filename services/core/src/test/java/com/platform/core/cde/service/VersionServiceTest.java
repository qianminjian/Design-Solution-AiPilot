package com.platform.core.cde.service;

import com.platform.core.cde.domain.Document;
import com.platform.core.cde.domain.DocumentStatus;
import com.platform.core.cde.domain.DocumentVersion;
import com.platform.core.cde.dto.DocumentVersionDto;
import com.platform.core.cde.dto.UploadVersionRequest;
import com.platform.core.cde.repository.DocumentRepository;
import com.platform.core.cde.repository.DocumentVersionRepository;
import com.platform.core.cde.support.CurrentUserResolver;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VersionServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private DocumentVersionRepository versionRepository;

    private CurrentUserResolver currentUserResolver;
    private VersionService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID documentId = UUID.randomUUID();
    private final UUID versionId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        currentUserResolver = new CurrentUserResolver() {
            @Override
            public UUID getCurrentPrincipalId() {
                return userId;
            }
        };
        service = new VersionService(documentRepository, versionRepository, currentUserResolver);
    }

    @Test
    @DisplayName("应该成功上传新版本")
    void shouldUploadVersionSuccessfully() {
        Document document = new Document();
        document.setId(documentId);
        document.setTenantId(tenantId);
        document.setProjectId(UUID.randomUUID());
        document.setStatus(DocumentStatus.DRAFT);
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.of(document));
        when(documentRepository.save(any(Document.class))).thenReturn(document);

        when(versionRepository.findMaxVersionNumber(eq(documentId))).thenReturn(1);

        DocumentVersion version = new DocumentVersion();
        version.setId(versionId);
        version.setDocumentId(documentId);
        version.setVersionNumber(2);
        version.setStatus("DRAFT");
        version.setUploadedAt(Instant.now());
        when(versionRepository.save(any(DocumentVersion.class))).thenReturn(version);

        UploadVersionRequest request = new UploadVersionRequest(
                "storage-key-002",
                "b".repeat(64),
                "更新版本",
                2048L,
                "application/octet-stream"
        );

        DocumentVersionDto dto = service.uploadVersion(tenantId, documentId, request);

        assertThat(dto.id()).isEqualTo(versionId);
        assertThat(dto.versionNumber()).isEqualTo(2);
        assertThat(dto.status()).isEqualTo("DRAFT");
        verify(versionRepository).save(any(DocumentVersion.class));
        verify(documentRepository).save(any(Document.class));
    }

    @Test
    @DisplayName("应该在文档不存在时抛出业务异常")
    void shouldThrowWhenDocumentNotFound() {
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.empty());

        UploadVersionRequest request = new UploadVersionRequest(
                "storage-key-002",
                "b".repeat(64),
                null,
                2048L,
                "application/octet-stream"
        );

        assertThatThrownBy(() -> service.uploadVersion(tenantId, documentId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.DOCUMENT_NOT_FOUND);
    }

    @Test
    @DisplayName("应该在文档已检出时拒绝上传新版本")
    void shouldRejectUploadWhenCheckedOut() {
        Document document = new Document();
        document.setId(documentId);
        document.setTenantId(tenantId);
        document.setStatus(DocumentStatus.CHECKED_OUT);
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.of(document));

        UploadVersionRequest request = new UploadVersionRequest(
                "storage-key-002",
                "b".repeat(64),
                null,
                2048L,
                "application/octet-stream"
        );

        assertThatThrownBy(() -> service.uploadVersion(tenantId, documentId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.DOCUMENT_CHECKED_OUT);
    }

    @Test
    @DisplayName("应该在文档已归档时拒绝上传新版本")
    void shouldRejectUploadWhenArchived() {
        Document document = new Document();
        document.setId(documentId);
        document.setTenantId(tenantId);
        document.setStatus(DocumentStatus.ARCHIVED);
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.of(document));

        UploadVersionRequest request = new UploadVersionRequest(
                "storage-key-002",
                "b".repeat(64),
                null,
                2048L,
                "application/octet-stream"
        );

        assertThatThrownBy(() -> service.uploadVersion(tenantId, documentId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_DOCUMENT_STATUS);
    }

    @Test
    @DisplayName("应该成功查询文档所有版本")
    void shouldListVersionsSuccessfully() {
        Document document = new Document();
        document.setId(documentId);
        document.setTenantId(tenantId);
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.of(document));

        DocumentVersion v1 = new DocumentVersion();
        v1.setId(UUID.randomUUID());
        v1.setDocumentId(documentId);
        v1.setTenantId(tenantId);
        v1.setVersionNumber(2);
        v1.setStatus("DRAFT");

        DocumentVersion v2 = new DocumentVersion();
        v2.setId(versionId);
        v2.setDocumentId(documentId);
        v2.setTenantId(tenantId);
        v2.setVersionNumber(1);
        v2.setStatus("SUPERSEDED");

        when(versionRepository.findByDocumentIdAndTenantIdOrderByVersionNumberDesc(eq(documentId), eq(tenantId)))
                .thenReturn(List.of(v1, v2));

        List<DocumentVersionDto> versions = service.listVersions(tenantId, documentId);

        assertThat(versions).hasSize(2);
        assertThat(versions.get(0).versionNumber()).isEqualTo(2);
        assertThat(versions.get(1).versionNumber()).isEqualTo(1);
    }

    @Test
    @DisplayName("应该成功查询单个版本详情")
    void shouldGetVersionSuccessfully() {
        Document document = new Document();
        document.setId(documentId);
        document.setTenantId(tenantId);
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.of(document));

        DocumentVersion version = new DocumentVersion();
        version.setId(versionId);
        version.setDocumentId(documentId);
        version.setTenantId(tenantId);
        version.setVersionNumber(1);
        version.setStatus("DRAFT");
        when(versionRepository.findByIdAndTenantId(eq(versionId), eq(tenantId))).thenReturn(Optional.of(version));

        DocumentVersionDto dto = service.getVersion(tenantId, documentId, versionId);

        assertThat(dto.id()).isEqualTo(versionId);
        assertThat(dto.versionNumber()).isEqualTo(1);
    }

    @Test
    @DisplayName("应该在版本不属于指定文档时抛出业务异常")
    void shouldThrowWhenVersionNotBelongToDocument() {
        Document document = new Document();
        document.setId(documentId);
        document.setTenantId(tenantId);
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.of(document));

        UUID otherDocumentId = UUID.randomUUID();
        DocumentVersion version = new DocumentVersion();
        version.setId(versionId);
        version.setDocumentId(otherDocumentId);
        version.setTenantId(tenantId);
        when(versionRepository.findByIdAndTenantId(eq(versionId), eq(tenantId))).thenReturn(Optional.of(version));

        assertThatThrownBy(() -> service.getVersion(tenantId, documentId, versionId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.VERSION_NOT_FOUND);
    }
}