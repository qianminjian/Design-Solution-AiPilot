package com.platform.core.compliance.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.compliance.dto.ComplianceFindingDto;
import com.platform.core.compliance.dto.FindingCommandRequest;
import com.platform.core.compliance.service.FindingService;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/compliance-findings")
public class FindingController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final FindingService findingService;
    private final TenantResolver tenantResolver;

    public FindingController(FindingService findingService, TenantResolver tenantResolver) {
        this.findingService = findingService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping("/{id}")
    public ApiResponse<ComplianceFindingDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ComplianceFindingDto dto = findingService.getFinding(tenantId, id);
        return ApiResponse.success(dto);
    }

    @GetMapping
    public PageResponse<ComplianceFindingDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID assignedTo,
            @RequestParam(defaultValue = "desc") String order,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
        Sort.Direction direction = "asc".equalsIgnoreCase(order)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(safePage - 1, safeSize, Sort.by(direction, DEFAULT_SORT_FIELD));
        Page<ComplianceFindingDto> result = findingService.listFindings(tenantId, severity, status, assignedTo, pageable);
        return PageResponse.success(result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @PatchMapping("/{id}")
    public ApiResponse<ComplianceFindingDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody FindingCommandRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ComplianceFindingDto dto = findingService.updateFinding(tenantId, id, request);
        return ApiResponse.success(dto);
    }
}