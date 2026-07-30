package com.platform.core.governance.evidence.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.governance.domain.enums.GovernanceEvidencePackageStatus;
import com.platform.core.governance.evidence.dto.EvidencePackageActionRequest;
import com.platform.core.governance.evidence.dto.EvidencePackageDto;
import com.platform.core.governance.evidence.service.EvidencePackageService;
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
 * 治理域证据包 Controller（D37.17 Audit/Evidence 证据包）
 *
 * 路由：/api/v1/evidence-packages/**
 */
@RestController
@RequestMapping("/api/v1/evidence-packages")
public class EvidencePackageController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final EvidencePackageService evidencePackageService;
    private final TenantResolver tenantResolver;

    public EvidencePackageController(
            EvidencePackageService evidencePackageService,
            TenantResolver tenantResolver
    ) {
        this.evidencePackageService = evidencePackageService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<EvidencePackageDto> list(
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
        GovernanceEvidencePackageStatus statusEnum = parseStatus(status);
        Page<EvidencePackageDto> result = evidencePackageService.listEvidencePackages(
                tenantId, statusEnum, pageable);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<EvidencePackageDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(evidencePackageService.getEvidencePackage(tenantId, id));
    }

    @PostMapping("/{id}/actions")
    public ApiResponse<EvidencePackageDto> actOnEvidencePackage(
            @PathVariable UUID id,
            @Valid @RequestBody EvidencePackageActionRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(
                evidencePackageService.actOnEvidencePackage(
                        tenantId, id, request, httpRequest));
    }

    private GovernanceEvidencePackageStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return GovernanceEvidencePackageStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
