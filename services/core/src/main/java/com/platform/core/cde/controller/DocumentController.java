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
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 文档 REST API
 * 路径：/api/v1/projects/{projectId}/documents + /api/v1/documents/{id}
 * 对齐 cde.contract.ts §CdeApiPaths
 */
@RestController
@RequestMapping("/api/v1")
public class DocumentController {

    /** 默认每页条数上限 */
    private static final int MAX_PAGE_SIZE = 100;
    /** 默认排序字段白名单（防 SQL 注入） */
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final DocumentService documentService;
    private final TenantResolver tenantResolver;

    public DocumentController(DocumentService documentService, TenantResolver tenantResolver) {
        this.documentService = documentService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 创建文档（含初始版本 v1）
     * POST /api/v1/projects/{projectId}/documents
     */
    @PostMapping("/projects/{projectId}/documents")
    public ResponseEntity<ApiResponse<DocumentDto>> create(
            @PathVariable UUID projectId,
            @Valid @RequestBody CreateDocumentRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        DocumentDto dto = documentService.createDocument(tenantId, projectId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    /**
     * 分页查询项目下文档
     * GET /api/v1/projects/{projectId}/documents
     */
    @GetMapping("/projects/{projectId}/documents")
    public PageResponse<DocumentDto> list(
            @PathVariable UUID projectId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "desc") String order,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
        Sort.Direction direction = "asc".equalsIgnoreCase(order)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(safePage - 1, safeSize, Sort.by(direction, DEFAULT_SORT_FIELD));
        ListDocumentsRequest request = new ListDocumentsRequest(safePage, safeSize, null, order, status, keyword);
        Page<DocumentDto> result = documentService.listDocuments(tenantId, projectId, request, pageable);
        return PageResponse.success(result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    /**
     * 查询文档详情
     * GET /api/v1/documents/{id}
     */
    @GetMapping("/documents/{id}")
    public ApiResponse<DocumentDto> get(@PathVariable UUID id, HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        DocumentDto dto = documentService.getDocument(tenantId, id);
        return ApiResponse.success(dto);
    }

    /**
     * 部分更新文档元数据
     * PATCH /api/v1/documents/{id}
     */
    @PatchMapping("/documents/{id}")
    public ApiResponse<DocumentDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateDocumentRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        DocumentDto dto = documentService.updateDocument(tenantId, id, request);
        return ApiResponse.success(dto);
    }

    /**
     * 软删除文档
     * DELETE /api/v1/documents/{id}
     */
    @DeleteMapping("/documents/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable UUID id, HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        documentService.deleteDocument(tenantId, id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
