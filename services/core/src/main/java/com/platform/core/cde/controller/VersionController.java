package com.platform.core.cde.controller;

import com.platform.core.cde.dto.DocumentVersionDto;
import com.platform.core.cde.dto.UploadVersionRequest;
import com.platform.core.cde.service.VersionService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * 文档版本 REST API
 * 路径：/api/v1/documents/{id}/versions
 * 对齐 cde.contract.ts §CdeApiPaths.versions / version
 */
@RestController
@RequestMapping("/api/v1/documents/{documentId}/versions")
public class VersionController {

    private final VersionService versionService;
    private final TenantResolver tenantResolver;

    public VersionController(VersionService versionService, TenantResolver tenantResolver) {
        this.versionService = versionService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 上传新版本（自动递增 versionNumber，旧版本转为 SUPERSEDED）
     * POST /api/v1/documents/{documentId}/versions
     */
    @PostMapping
    public ResponseEntity<ApiResponse<DocumentVersionDto>> upload(
            @PathVariable UUID documentId,
            @Valid @RequestBody UploadVersionRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        DocumentVersionDto dto = versionService.uploadVersion(tenantId, documentId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    /**
     * 查询文档所有版本（按 versionNumber 降序）
     * GET /api/v1/documents/{documentId}/versions
     */
    @GetMapping
    public ApiResponse<List<DocumentVersionDto>> list(
            @PathVariable UUID documentId, HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        List<DocumentVersionDto> versions = versionService.listVersions(tenantId, documentId);
        return ApiResponse.success(versions);
    }

    /**
     * 查询单个版本详情
     * GET /api/v1/documents/{documentId}/versions/{versionId}
     */
    @GetMapping("/{versionId}")
    public ApiResponse<DocumentVersionDto> get(
            @PathVariable UUID documentId,
            @PathVariable UUID versionId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        DocumentVersionDto dto = versionService.getVersion(tenantId, documentId, versionId);
        return ApiResponse.success(dto);
    }
}
