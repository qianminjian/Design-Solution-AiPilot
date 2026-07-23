package com.platform.core.cde.service;

import com.platform.core.cde.domain.Document;
import com.platform.core.cde.domain.DocumentStatus;
import com.platform.core.cde.domain.DocumentVersion;
import com.platform.core.cde.dto.CreateDocumentRequest;
import com.platform.core.cde.dto.DocumentDto;
import com.platform.core.cde.dto.UpdateDocumentRequest;
import com.platform.core.cde.repository.DocumentRepository;
import com.platform.core.cde.repository.DocumentVersionRepository;
import com.platform.core.cde.support.CurrentUserResolver;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.portfolio.domain.Project;
import com.platform.core.portfolio.repository.ProjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;

@ExtendWith(MockitoExtension.class)
class DocumentServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private DocumentVersionRepository versionRepository;

    @Mock
    private ProjectRepository projectRepository;

    private CurrentUserResolver currentUserResolver;
    private DocumentService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
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
        service = new DocumentService(documentRepository, versionRepository, projectRepository, currentUserResolver);
    }

    @Test
    @DisplayName("应该成功创建文档并自动创建初始版本")
    void shouldCreateDocumentWithInitialVersion() {
        when(projectRepository.findByIdAndTenantId(eq(projectId), eq(tenantId)))
                .thenReturn(Optional.of(new Project()));

        Document document = new Document();
        document.setId(documentId);
        document.setTenantId(tenantId);
        document.setProjectId(projectId);
        document.setName("测试文档");
        document.setPath("/projects/test/doc.rvt");
        document.setMimeType("application/octet-stream");
        document.setStatus(DocumentStatus.DRAFT);
        document.setCreatedAt(Instant.now());
        document.setUpdatedAt(Instant.now());
        when(documentRepository.save(any(Document.class))).thenReturn(document);

        DocumentVersion version = new DocumentVersion();
        version.setId(versionId);
        version.setDocumentId(documentId);
        version.setVersionNumber(1);
        version.setStatus("DRAFT");
        when(versionRepository.save(any(DocumentVersion.class))).thenReturn(version);

        CreateDocumentRequest request = new CreateDocumentRequest(
                "测试文档",
                "/projects/test/doc.rvt",
                "application/octet-stream",
                1024L,
                "storage-key-001",
                "a".repeat(64),
                "初始版本"
        );

        DocumentDto dto = service.createDocument(tenantId, projectId, request);

        assertThat(dto.id()).isEqualTo(documentId);
        assertThat(dto.name()).isEqualTo("测试文档");
        assertThat(dto.status()).isEqualTo(DocumentStatus.DRAFT);
        assertThat(dto.currentVersionId()).isEqualTo(versionId);
        verify(documentRepository, times(2)).save(any(Document.class));
        verify(versionRepository).save(any(DocumentVersion.class));
    }

    @Test
    @DisplayName("应该在项目不存在时抛出业务异常")
    void shouldThrowWhenProjectNotFound() {
        when(projectRepository.findByIdAndTenantId(eq(projectId), eq(tenantId))).thenReturn(Optional.empty());

        CreateDocumentRequest request = new CreateDocumentRequest(
                "测试文档",
                "/projects/test/doc.rvt",
                "application/octet-stream",
                1024L,
                "storage-key-001",
                "a".repeat(64),
                null
        );

        assertThatThrownBy(() -> service.createDocument(tenantId, projectId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PROJECT_NOT_FOUND);
    }

    @Test
    @DisplayName("应该成功查询文档详情")
    void shouldGetDocumentSuccessfully() {
        Document document = new Document();
        document.setId(documentId);
        document.setTenantId(tenantId);
        document.setProjectId(projectId);
        document.setName("测试文档");
        document.setStatus(DocumentStatus.DRAFT);
        document.setCreatedAt(Instant.now());
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.of(document));

        DocumentDto dto = service.getDocument(tenantId, documentId);

        assertThat(dto.id()).isEqualTo(documentId);
        assertThat(dto.name()).isEqualTo("测试文档");
    }

    @Test
    @DisplayName("应该在文档不存在时抛出业务异常")
    void shouldThrowWhenDocumentNotFound() {
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getDocument(tenantId, documentId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.DOCUMENT_NOT_FOUND);
    }

    @Test
    @DisplayName("应该成功更新文档")
    void shouldUpdateDocumentSuccessfully() {
        Document document = new Document();
        document.setId(documentId);
        document.setTenantId(tenantId);
        document.setName("旧名称");
        document.setStatus(DocumentStatus.DRAFT);
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.of(document));
        when(documentRepository.save(any(Document.class))).thenReturn(document);

        UpdateDocumentRequest request = new UpdateDocumentRequest(
                "新名称",
                null,
                null
        );

        DocumentDto dto = service.updateDocument(tenantId, documentId, request);

        assertThat(dto.name()).isEqualTo("新名称");
        verify(documentRepository).save(any(Document.class));
    }

    @Test
    @DisplayName("应该在文档已归档时拒绝更新")
    void shouldRejectUpdateWhenArchived() {
        Document document = new Document();
        document.setId(documentId);
        document.setTenantId(tenantId);
        document.setStatus(DocumentStatus.ARCHIVED);
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.of(document));

        UpdateDocumentRequest request = new UpdateDocumentRequest(
                "新名称",
                null,
                null
        );

        assertThatThrownBy(() -> service.updateDocument(tenantId, documentId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_DOCUMENT_STATUS);
    }

    @Test
    @DisplayName("应该成功软删除 DRAFT 状态文档")
    void shouldSoftDeleteDraftDocument() {
        Document document = new Document();
        document.setId(documentId);
        document.setTenantId(tenantId);
        document.setStatus(DocumentStatus.DRAFT);
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.of(document));
        when(documentRepository.save(any(Document.class))).thenReturn(document);

        service.deleteDocument(tenantId, documentId);

        assertThat(document.getDeletedAt()).isNotNull();
        assertThat(document.getDeletedBy()).isEqualTo(userId);
        verify(documentRepository).save(any(Document.class));
    }

    @Test
    @DisplayName("应该在文档非 DRAFT 状态时拒绝删除")
    void shouldRejectDeleteWhenNotDraft() {
        Document document = new Document();
        document.setId(documentId);
        document.setTenantId(tenantId);
        document.setStatus(DocumentStatus.PUBLISHED);
        when(documentRepository.findByIdAndTenantId(eq(documentId), eq(tenantId))).thenReturn(Optional.of(document));

        assertThatThrownBy(() -> service.deleteDocument(tenantId, documentId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_DOCUMENT_STATUS);
    }
}