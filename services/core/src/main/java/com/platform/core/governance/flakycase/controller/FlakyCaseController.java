package com.platform.core.governance.flakycase.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.governance.flakycase.domain.FlakyCaseStatus;
import com.platform.core.governance.flakycase.dto.FlakyCaseDto;
import com.platform.core.governance.flakycase.dto.FlakyIsolateRequest;
import com.platform.core.governance.flakycase.dto.FlakyReportRequest;
import com.platform.core.governance.flakycase.dto.FlakyResolveRequest;
import com.platform.core.governance.flakycase.service.FlakyCaseService;
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

import java.util.Map;
import java.util.UUID;

/**
 * Flaky Case Controller（D45.22 Flaky 治理，SIT P0-13.2）
 *
 * 路由：/api/v1/flaky-cases/**
 *  - GET /                列表（status 过滤）
 *  - POST /report         运行结果上报（连续不稳定检测）
 *  - GET /{id}            详情
 *  - POST /{id}:isolate   隔离（Requirement 变 Coverage Gap）
 *  - POST /{id}:resolve   修复（根因分类 + 最小回归样本）
 *  - GET /rate-exceeded   Flaky Case 率验收判定（< 5%）
 */
@RestController
@RequestMapping("/api/v1/flaky-cases")
public class FlakyCaseController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final FlakyCaseService flakyCaseService;
    private final TenantResolver tenantResolver;

    public FlakyCaseController(
            FlakyCaseService flakyCaseService,
            TenantResolver tenantResolver
    ) {
        this.flakyCaseService = flakyCaseService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<FlakyCaseDto> list(
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
        FlakyCaseStatus statusEnum = parseStatus(status);
        Page<FlakyCaseDto> result = flakyCaseService.list(tenantId, statusEnum, pageable);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<FlakyCaseDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(flakyCaseService.get(tenantId, id));
    }

    @PostMapping("/report")
    public ApiResponse<FlakyCaseDto> report(
            @Valid @RequestBody FlakyReportRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(flakyCaseService.report(tenantId, request));
    }

    @PostMapping("/{id}:isolate")
    public ApiResponse<FlakyCaseDto> isolate(
            @PathVariable UUID id,
            @Valid @RequestBody FlakyIsolateRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(flakyCaseService.isolate(tenantId, id, request));
    }

    @PostMapping("/{id}:resolve")
    public ApiResponse<FlakyCaseDto> resolve(
            @PathVariable UUID id,
            @Valid @RequestBody FlakyResolveRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(flakyCaseService.resolve(tenantId, id, request));
    }

    /** Flaky Case 率验收判定（D45.22 验收：< 5%） */
    @GetMapping("/rate-exceeded")
    public ApiResponse<Map<String, Boolean>> rateExceeded(HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        boolean exceeded = flakyCaseService.isFlakyRateExceeded(tenantId);
        return ApiResponse.success(Map.of("exceeded", exceeded));
    }

    private FlakyCaseStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return FlakyCaseStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
