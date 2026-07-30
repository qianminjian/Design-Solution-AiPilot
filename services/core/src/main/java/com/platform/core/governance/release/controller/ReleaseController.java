package com.platform.core.governance.release.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.governance.domain.enums.GovernanceReleaseStatus;
import com.platform.core.governance.release.dto.ReleaseActionRequest;
import com.platform.core.governance.release.dto.ReleaseDto;
import com.platform.core.governance.release.service.ReleaseService;
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
 * 治理域 Release Controller（D37.17 AI/Rule Release）
 *
 * 路由：/api/v1/releases/**
 */
@RestController
@RequestMapping("/api/v1/releases")
public class ReleaseController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final ReleaseService releaseService;
    private final TenantResolver tenantResolver;

    public ReleaseController(
            ReleaseService releaseService,
            TenantResolver tenantResolver
    ) {
        this.releaseService = releaseService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<ReleaseDto> list(
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
        GovernanceReleaseStatus statusEnum = parseStatus(status);
        Page<ReleaseDto> result = releaseService.listReleases(
                tenantId, statusEnum, pageable);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<ReleaseDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(releaseService.getRelease(tenantId, id));
    }

    @PostMapping("/{id}/actions")
    public ApiResponse<ReleaseDto> actOnRelease(
            @PathVariable UUID id,
            @Valid @RequestBody ReleaseActionRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(
                releaseService.actOnRelease(tenantId, id, request, httpRequest));
    }

    private GovernanceReleaseStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return GovernanceReleaseStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
