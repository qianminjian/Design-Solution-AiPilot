package com.platform.core.governance.qualitygate.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.governance.qualitygate.domain.QualityGateStatus;
import com.platform.core.governance.qualitygate.dto.QualityGateCreateRequest;
import com.platform.core.governance.qualitygate.dto.QualityGateDto;
import com.platform.core.governance.qualitygate.dto.QualityGateSignRequest;
import com.platform.core.governance.qualitygate.service.QualityGateService;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 质量门禁 Controller（D45.23 质量门禁与验收签署，SIT P0-13.4）
 *
 * 路由：/api/v1/quality-gates/**
 *  - GET /                列表（status 过滤）
 *  - POST /               创建（6 级 Gate 预置检查项）
 *  - GET /{id}            详情
 *  - POST /{id}:sign      签署（AI 不代签红线）
 */
@RestController
@RequestMapping("/api/v1/quality-gates")
public class QualityGateController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final QualityGateService qualityGateService;
    private final TenantResolver tenantResolver;

    public QualityGateController(
            QualityGateService qualityGateService,
            TenantResolver tenantResolver
    ) {
        this.qualityGateService = qualityGateService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<QualityGateDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "desc") String order,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
        Sort.Direction direction = "asc".equalsIgnoreCase(order)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(
                safePage - 1, safeSize, Sort.by(direction, DEFAULT_SORT_FIELD));
        QualityGateStatus statusEnum = parseStatus(status);
        Page<QualityGateDto> result = qualityGateService.list(tenantId, statusEnum, pageable);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<QualityGateDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(qualityGateService.get(tenantId, id));
    }

    @PostMapping
    public ApiResponse<QualityGateDto> create(
            @Valid @RequestBody QualityGateCreateRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(qualityGateService.create(tenantId, request));
    }

    /** 门禁签署（D45.23：每 Gate 签署角色落实，AI 不代签） */
    @PostMapping("/{id}:sign")
    public ApiResponse<QualityGateDto> sign(
            @PathVariable UUID id,
            @Valid @RequestBody QualityGateSignRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(qualityGateService.sign(tenantId, id, request));
    }

    private QualityGateStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return QualityGateStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
