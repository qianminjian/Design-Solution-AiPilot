package com.platform.core.cde.controller;

import com.platform.core.cde.dto.CreateDocumentRequest;
import com.platform.core.cde.dto.DocumentDto;
import com.platform.core.cde.dto.ListDocumentsRequest;
import com.platform.core.cde.dto.UpdateDocumentRequest;
import com.platform.core.cde.service.DocumentService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 文档控制器单元测试
 *
 * <p>覆盖点：
 * <ul>
 *   <li>创建文档：返回 201 与 DTO</li>
 *   <li>分页查询：参数安全处理（page<1、pageSize 越界）、排序方向、过滤参数透传</li>
 *   <li>查询详情：返回 200 与 DTO</li>
 *   <li>部分更新：透传 service 返回</li>
 *   <li>软删除：返回 200 与 null data</li>
 *   <li>租户 ID 注入：每次请求都通过 TenantResolver 解析并透传给 service</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class DocumentControllerTest {

    @Mock
    private DocumentService documentService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private DocumentController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID documentId = UUID.randomUUID();
    private final UUID versionId = UUID.randomUUID();
    private final UUID createdBy = UUID.randomUUID();

    /** 64 位 SHA-256 测试校验和（全 a） */
    private static final String TEST_CHECKSUM = "a".repeat(64);

    @BeforeEach
    void setUp() {
        controller = new DocumentController(documentService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("创建文档应该返回 201 状态码与创建成功的文档")
    void createShouldReturn201WithDocument() {
        CreateDocumentRequest request = new CreateDocumentRequest(
                "方案设计图.dwg",
                "/project-1/drawings/scheme.dwg",
                "application/acad",
                1024L,
                "s3://bucket/tenant1/project1/doc1/v1.dwg",
                TEST_CHECKSUM,
                "初始版本"
        );
        DocumentDto dto = buildDocumentDto();
        when(documentService.createDocument(eq(tenantId), eq(projectId), any(CreateDocumentRequest.class)))
                .thenReturn(dto);

        ResponseEntity<ApiResponse<DocumentDto>> response =
                controller.create(projectId, request, httpRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isZero();
        assertThat(response.getBody().data()).isNotNull();
        assertThat(response.getBody().data().id()).isEqualTo(documentId);
        assertThat(response.getBody().data().name()).isEqualTo("方案设计图.dwg");
        assertThat(response.getBody().data().currentVersionId()).isEqualTo(versionId);
        verify(documentService).createDocument(eq(tenantId), eq(projectId), any(CreateDocumentRequest.class));
    }

    @Test
    @DisplayName("分页查询文档应该返回正确的分页结构")
    void listShouldReturnPageResponse() {
        List<DocumentDto> docs = Arrays.asList(buildDocumentDto(), buildDocumentDto());
        Page<DocumentDto> page = new PageImpl<>(docs);
        when(documentService.listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<DocumentDto> response = controller.list(
                projectId, 1, 20, null, null, "desc", httpRequest);

        assertThat(response.code()).isZero();
        assertThat(response.data().list()).hasSize(2);
        assertThat(response.data().total()).isEqualTo(2);
        assertThat(response.data().page()).isEqualTo(1);
        assertThat(response.data().pageSize()).isEqualTo(20);
    }

    @Test
    @DisplayName("分页查询 page 小于 1 时应该使用 1")
    void listShouldUseMinPageWhenPageTooSmall() {
        List<DocumentDto> docs = List.of(buildDocumentDto());
        Page<DocumentDto> page = new PageImpl<>(docs);
        when(documentService.listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<DocumentDto> response = controller.list(
                projectId, 0, 20, null, null, "desc", httpRequest);

        assertThat(response.data().page()).isEqualTo(1);
    }

    @Test
    @DisplayName("分页查询 page 为负数时应该使用 1")
    void listShouldUseMinPageWhenPageNegative() {
        List<DocumentDto> docs = List.of(buildDocumentDto());
        Page<DocumentDto> page = new PageImpl<>(docs);
        when(documentService.listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<DocumentDto> response = controller.list(
                projectId, -5, 20, null, null, "desc", httpRequest);

        assertThat(response.data().page()).isEqualTo(1);
    }

    @Test
    @DisplayName("分页查询 pageSize 超过上限时应该截断到 100")
    void listShouldCapPageSizeAtMax() {
        List<DocumentDto> docs = List.of(buildDocumentDto());
        Page<DocumentDto> page = new PageImpl<>(docs);
        when(documentService.listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<DocumentDto> response = controller.list(
                projectId, 1, 200, null, null, "desc", httpRequest);

        assertThat(response.data().pageSize()).isEqualTo(100);
    }

    @Test
    @DisplayName("分页查询 pageSize 小于 1 时应该使用 1")
    void listShouldUseMinPageSizeWhenTooSmall() {
        List<DocumentDto> docs = List.of(buildDocumentDto());
        Page<DocumentDto> page = new PageImpl<>(docs);
        when(documentService.listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), any(Pageable.class)))
                .thenReturn(page);

        PageResponse<DocumentDto> response = controller.list(
                projectId, 1, 0, null, null, "desc", httpRequest);

        assertThat(response.data().pageSize()).isEqualTo(1);
    }

    @Test
    @DisplayName("分页查询 order=asc 应该使用升序排序")
    void listShouldUseAscWhenOrderIsAsc() {
        List<DocumentDto> docs = List.of(buildDocumentDto());
        Page<DocumentDto> page = new PageImpl<>(docs);
        when(documentService.listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), any(Pageable.class)))
                .thenReturn(page);

        controller.list(projectId, 1, 20, null, null, "asc", httpRequest);

        // 验证传给 service 的 Pageable 是 ASC 方向，且字段为 createdAt
        org.mockito.ArgumentCaptor<Pageable> captor = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(documentService).listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), captor.capture());
        Pageable pageable = captor.getValue();
        Sort.Order order = pageable.getSort().getOrderFor("createdAt");
        assertThat(order).isNotNull();
        assertThat(order.getDirection()).isEqualTo(Sort.Direction.ASC);
        // Spring Data PageRequest 是 0-based，page=1 -> 第 0 页
        assertThat(pageable.getPageNumber()).isZero();
        assertThat(pageable.getPageSize()).isEqualTo(20);
    }

    @Test
    @DisplayName("分页查询 order=desc 应该使用降序排序")
    void listShouldUseDescWhenOrderIsDesc() {
        List<DocumentDto> docs = List.of(buildDocumentDto());
        Page<DocumentDto> page = new PageImpl<>(docs);
        when(documentService.listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), any(Pageable.class)))
                .thenReturn(page);

        controller.list(projectId, 1, 20, null, null, "desc", httpRequest);

        org.mockito.ArgumentCaptor<Pageable> captor = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(documentService).listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), captor.capture());
        Pageable pageable = captor.getValue();
        Sort.Order order = pageable.getSort().getOrderFor("createdAt");
        assertThat(order).isNotNull();
        assertThat(order.getDirection()).isEqualTo(Sort.Direction.DESC);
    }

    @Test
    @DisplayName("分页查询 order 为非法值时应该降级为 desc")
    void listShouldFallbackToDescWhenOrderInvalid() {
        List<DocumentDto> docs = List.of(buildDocumentDto());
        Page<DocumentDto> page = new PageImpl<>(docs);
        when(documentService.listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), any(Pageable.class)))
                .thenReturn(page);

        controller.list(projectId, 1, 20, null, null, "invalid", httpRequest);

        org.mockito.ArgumentCaptor<Pageable> captor = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(documentService).listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), captor.capture());
        Pageable pageable = captor.getValue();
        Sort.Order order = pageable.getSort().getOrderFor("createdAt");
        assertThat(order).isNotNull();
        assertThat(order.getDirection()).isEqualTo(Sort.Direction.DESC);
    }

    @Test
    @DisplayName("分页查询 order 为大小写混合时应该正确识别为 asc")
    void listShouldTreatOrderCaseInsensitively() {
        List<DocumentDto> docs = List.of(buildDocumentDto());
        Page<DocumentDto> page = new PageImpl<>(docs);
        when(documentService.listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), any(Pageable.class)))
                .thenReturn(page);

        controller.list(projectId, 1, 20, null, null, "ASC", httpRequest);

        org.mockito.ArgumentCaptor<Pageable> captor = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(documentService).listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), captor.capture());
        Pageable pageable = captor.getValue();
        Sort.Order order = pageable.getSort().getOrderFor("createdAt");
        assertThat(order).isNotNull();
        assertThat(order.getDirection()).isEqualTo(Sort.Direction.ASC);
    }

    @Test
    @DisplayName("分页查询应该透传 status 与 keyword 过滤参数")
    void listShouldPassThroughStatusAndKeyword() {
        List<DocumentDto> docs = List.of(buildDocumentDto());
        Page<DocumentDto> page = new PageImpl<>(docs);
        when(documentService.listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), any(Pageable.class)))
                .thenReturn(page);

        controller.list(projectId, 1, 20, "DRAFT", "方案", "desc", httpRequest);

        org.mockito.ArgumentCaptor<ListDocumentsRequest> captor =
                org.mockito.ArgumentCaptor.forClass(ListDocumentsRequest.class);
        verify(documentService).listDocuments(eq(tenantId), eq(projectId), captor.capture(), any(Pageable.class));
        ListDocumentsRequest passedRequest = captor.getValue();
        assertThat(passedRequest.status()).isEqualTo("DRAFT");
        assertThat(passedRequest.keyword()).isEqualTo("方案");
        assertThat(passedRequest.page()).isEqualTo(1);
        assertThat(passedRequest.pageSize()).isEqualTo(20);
        assertThat(passedRequest.order()).isEqualTo("desc");
    }

    @Test
    @DisplayName("分页查询应该使用安全处理后的 page/pageSize 构造 ListDocumentsRequest")
    void listShouldBuildRequestWithSafeParams() {
        List<DocumentDto> docs = List.of(buildDocumentDto());
        Page<DocumentDto> page = new PageImpl<>(docs);
        when(documentService.listDocuments(eq(tenantId), eq(projectId), any(ListDocumentsRequest.class), any(Pageable.class)))
                .thenReturn(page);

        // page=0 -> safePage=1；pageSize=200 -> safeSize=100
        controller.list(projectId, 0, 200, null, null, "desc", httpRequest);

        org.mockito.ArgumentCaptor<ListDocumentsRequest> captor =
                org.mockito.ArgumentCaptor.forClass(ListDocumentsRequest.class);
        verify(documentService).listDocuments(eq(tenantId), eq(projectId), captor.capture(), any(Pageable.class));
        ListDocumentsRequest passedRequest = captor.getValue();
        assertThat(passedRequest.page()).isEqualTo(1);
        assertThat(passedRequest.pageSize()).isEqualTo(100);
    }

    @Test
    @DisplayName("查询文档详情应该返回正确的文档")
    void getShouldReturnDocument() {
        DocumentDto dto = buildDocumentDto();
        when(documentService.getDocument(tenantId, documentId)).thenReturn(dto);

        ApiResponse<DocumentDto> response = controller.get(documentId, httpRequest);

        assertThat(response.code()).isZero();
        assertThat(response.data()).isNotNull();
        assertThat(response.data().id()).isEqualTo(documentId);
        assertThat(response.data().name()).isEqualTo("方案设计图.dwg");
        verify(documentService).getDocument(tenantId, documentId);
    }

    @Test
    @DisplayName("更新文档应该返回更新后的文档")
    void updateShouldReturnUpdatedDocument() {
        UpdateDocumentRequest request = new UpdateDocumentRequest(
                "新名称.dwg",
                "/updated/path.dwg",
                "application/acad"
        );
        DocumentDto updatedDto = new DocumentDto(
                documentId, tenantId, projectId,
                "新名称.dwg",
                "/updated/path.dwg",
                "application/acad",
                1024L, versionId, "DRAFT", TEST_CHECKSUM,
                createdBy, Instant.now(), Instant.now(), 1L
        );
        when(documentService.updateDocument(eq(tenantId), eq(documentId), any(UpdateDocumentRequest.class)))
                .thenReturn(updatedDto);

        ApiResponse<DocumentDto> response = controller.update(documentId, request, httpRequest);

        assertThat(response.code()).isZero();
        assertThat(response.data()).isNotNull();
        assertThat(response.data().name()).isEqualTo("新名称.dwg");
        assertThat(response.data().path()).isEqualTo("/updated/path.dwg");
        verify(documentService).updateDocument(eq(tenantId), eq(documentId), any(UpdateDocumentRequest.class));
    }

    @Test
    @DisplayName("软删除文档应该返回 200 与 null data")
    void deleteShouldReturn200WithNullData() {
        ResponseEntity<ApiResponse<Void>> response = controller.delete(documentId, httpRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isZero();
        assertThat(response.getBody().data()).isNull();
        verify(documentService).deleteDocument(tenantId, documentId);
    }

    @Test
    @DisplayName("每次请求都应该通过 TenantResolver 解析租户 ID")
    void shouldResolveTenantIdForEachRequest() {
        // 通过 create 验证一次
        CreateDocumentRequest createReq = new CreateDocumentRequest(
                "测试", "/t.dwg", "text/plain", 1L, "s3://k", TEST_CHECKSUM, null
        );
        when(documentService.createDocument(eq(tenantId), eq(projectId), any(CreateDocumentRequest.class)))
                .thenReturn(buildDocumentDto());
        controller.create(projectId, createReq, httpRequest);

        // 通过 get 验证一次
        when(documentService.getDocument(tenantId, documentId)).thenReturn(buildDocumentDto());
        controller.get(documentId, httpRequest);

        // 通过 delete 验证一次
        controller.delete(documentId, httpRequest);

        // TenantResolver 应该被调用 3 次（每次请求一次）
        verify(tenantResolver, org.mockito.Mockito.times(3)).resolveTenantId(httpRequest);
    }

    private DocumentDto buildDocumentDto() {
        Instant now = Instant.now();
        return new DocumentDto(
                documentId,
                tenantId,
                projectId,
                "方案设计图.dwg",
                "/project-1/drawings/scheme.dwg",
                "application/acad",
                1024L,
                versionId,
                "DRAFT",
                TEST_CHECKSUM,
                createdBy,
                now,
                now,
                1L
        );
    }
}
