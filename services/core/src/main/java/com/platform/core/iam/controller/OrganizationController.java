package com.platform.core.iam.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.dto.CreateOrganizationRequest;
import com.platform.core.iam.dto.OrganizationDto;
import com.platform.core.iam.service.OrganizationService;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 组织 REST API
 * 路径：/api/v1/organizations
 */
@RestController
@RequestMapping("/api/v1/organizations")
public class OrganizationController {

    private static final int MAX_PAGE_SIZE = 100;

    private final OrganizationService organizationService;
    private final TenantResolver tenantResolver;

    public OrganizationController(OrganizationService organizationService, TenantResolver tenantResolver) {
        this.organizationService = organizationService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 创建组织
     */
    @PostMapping
    public ResponseEntity<ApiResponse<OrganizationDto>> create(
            @Valid @RequestBody CreateOrganizationRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        OrganizationDto dto = organizationService.createOrganization(tenantId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    /**
     * 查询组织详情
     */
    @GetMapping("/{id}")
    public ApiResponse<OrganizationDto> get(@PathVariable UUID id, HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        OrganizationDto dto = organizationService.getOrganization(tenantId, id);
        return ApiResponse.success(dto);
    }

    /**
     * 分页查询组织（按父 ID；不传则查顶层）
     */
    @GetMapping
    public PageResponse<OrganizationDto> list(
            @RequestParam(required = false) UUID parentId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        Pageable pageable = PageRequest.of(
                Math.max(0, page - 1),
                Math.min(pageSize, MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.ASC, "name"));
        Page<OrganizationDto> result = organizationService.listOrganizations(tenantId, parentId, pageable);
        return PageResponse.success(result.getContent(), result.getTotalElements(), page, pageSize);
    }
}
