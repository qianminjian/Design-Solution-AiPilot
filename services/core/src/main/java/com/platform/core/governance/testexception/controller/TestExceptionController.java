package com.platform.core.governance.testexception.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.governance.testexception.domain.TestExceptionStatus;
import com.platform.core.governance.testexception.dto.TestExceptionCreateRequest;
import com.platform.core.governance.testexception.dto.TestExceptionDto;
import com.platform.core.governance.testexception.dto.TestExceptionRevokeRequest;
import com.platform.core.governance.testexception.service.TestExceptionService;
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
 * 测试例外 Controller（D45.22 例外治理 / D45.25 TestException API，SIT P0-13.3）
 *
 * 路由：/api/v1/test-exceptions/**
 *  - GET /                列表（status 过滤）
 *  - POST /               创建（approvers 签署即生效）
 *  - GET /{id}            详情
 *  - POST /{id}:revoke    撤销（仅 ACTIVE/PENDING_REVIEW）
 */
@RestController
@RequestMapping("/api/v1/test-exceptions")
public class TestExceptionController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final TestExceptionService testExceptionService;
    private final TenantResolver tenantResolver;

    public TestExceptionController(
            TestExceptionService testExceptionService,
            TenantResolver tenantResolver
    ) {
        this.testExceptionService = testExceptionService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<TestExceptionDto> list(
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
        TestExceptionStatus statusEnum = parseStatus(status);
        Page<TestExceptionDto> result = testExceptionService.list(tenantId, statusEnum, pageable);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<TestExceptionDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(testExceptionService.get(tenantId, id));
    }

    @PostMapping
    public ApiResponse<TestExceptionDto> create(
            @Valid @RequestBody TestExceptionCreateRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(testExceptionService.create(tenantId, request));
    }

    @PostMapping("/{id}:revoke")
    public ApiResponse<TestExceptionDto> revoke(
            @PathVariable UUID id,
            @Valid @RequestBody TestExceptionRevokeRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(testExceptionService.revoke(tenantId, id, request));
    }

    private TestExceptionStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return TestExceptionStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
