package com.platform.core.iam.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.dto.CreatePrincipalRequest;
import com.platform.core.iam.dto.PrincipalDto;
import com.platform.core.iam.dto.UpdatePrincipalRequest;
import com.platform.core.iam.service.PrincipalService;
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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 主体 REST API
 * 路径：/api/v1/principals（见 iam.contract.ts §IamApiPaths）
 */
@RestController
@RequestMapping("/api/v1/principals")
public class PrincipalController {

    /** 默认每页条数上限 */
    private static final int MAX_PAGE_SIZE = 100;

    private final PrincipalService principalService;
    private final TenantResolver tenantResolver;

    public PrincipalController(PrincipalService principalService, TenantResolver tenantResolver) {
        this.principalService = principalService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 创建主体
     */
    @PostMapping
    public ResponseEntity<ApiResponse<PrincipalDto>> create(
            @Valid @RequestBody CreatePrincipalRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        PrincipalDto dto = principalService.createPrincipal(tenantId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    /**
     * 查询主体详情
     */
    @GetMapping("/{id}")
    public ApiResponse<PrincipalDto> get(@PathVariable UUID id, HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        PrincipalDto dto = principalService.getPrincipal(tenantId, id);
        return ApiResponse.success(dto);
    }

    /**
     * 分页查询主体
     */
    @GetMapping
    public PageResponse<PrincipalDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        Pageable pageable = PageRequest.of(
                Math.max(0, page - 1),
                Math.min(pageSize, MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<PrincipalDto> result = principalService.listPrincipals(tenantId, pageable);
        return PageResponse.success(result.getContent(), result.getTotalElements(), page, pageSize);
    }

    /**
     * 部分更新主体
     */
    @PatchMapping("/{id}")
    public ApiResponse<PrincipalDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdatePrincipalRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        PrincipalDto dto = principalService.updatePrincipal(tenantId, id, request);
        return ApiResponse.success(dto);
    }
}
