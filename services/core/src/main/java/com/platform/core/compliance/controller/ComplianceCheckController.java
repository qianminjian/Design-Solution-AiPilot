package com.platform.core.compliance.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.compliance.dto.CheckResultDto;
import com.platform.core.compliance.dto.ComplianceCheckRunDto;
import com.platform.core.compliance.dto.CreateCheckRunRequest;
import com.platform.core.compliance.service.ComplianceCheckService;
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

@RestController
@RequestMapping("/api/v1/compliance-checks")
public class ComplianceCheckController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final ComplianceCheckService checkService;
    private final TenantResolver tenantResolver;

    public ComplianceCheckController(ComplianceCheckService checkService, TenantResolver tenantResolver) {
        this.checkService = checkService;
        this.tenantResolver = tenantResolver;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ComplianceCheckRunDto>> createCheckRun(
            @Valid @RequestBody CreateCheckRunRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ComplianceCheckRunDto dto = checkService.createCheckRun(tenantId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    @PostMapping("/{id}/execute")
    public ApiResponse<ComplianceCheckRunDto> executeCheckRun(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ComplianceCheckRunDto dto = checkService.executeCheckRun(tenantId, id);
        return ApiResponse.success(dto);
    }

    @GetMapping("/{id}")
    public ApiResponse<ComplianceCheckRunDto> getCheckRun(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ComplianceCheckRunDto dto = checkService.getCheckRun(tenantId, id);
        return ApiResponse.success(dto);
    }

    @GetMapping
    public PageResponse<ComplianceCheckRunDto> listCheckRuns(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(defaultValue = "desc") String order,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
        Sort.Direction direction = "asc".equalsIgnoreCase(order)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(safePage - 1, safeSize, Sort.by(direction, DEFAULT_SORT_FIELD));
        Page<ComplianceCheckRunDto> result = checkService.listCheckRuns(tenantId, projectId, pageable);
        return PageResponse.success(result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/executions/{executionId}/results")
    public PageResponse<CheckResultDto> listCheckResults(
            @PathVariable UUID executionId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String outcome,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(safePage - 1, safeSize);
        Page<CheckResultDto> result = checkService.listCheckResults(tenantId, executionId, outcome, pageable);
        return PageResponse.success(result.getContent(), result.getTotalElements(), safePage, safeSize);
    }
}