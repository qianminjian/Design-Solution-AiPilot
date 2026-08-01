package com.platform.core.governance.testevidence.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.governance.testevidence.domain.TestEvidenceType;
import com.platform.core.governance.testevidence.dto.TestEvidenceCreateRequest;
import com.platform.core.governance.testevidence.dto.TestEvidenceDto;
import com.platform.core.governance.testevidence.dto.TestEvidenceVerifyRequest;
import com.platform.core.governance.testevidence.dto.TestEvidenceVerifyResult;
import com.platform.core.governance.testevidence.service.TestEvidenceService;
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
 * 测试证据 Controller（D45.10 TestEvidence，P0-1.4）
 *
 * 路由：/api/v1/test-evidence/**
 * 证据链语义：只追加（WORM），不支持修改/删除。
 */
@RestController
@RequestMapping("/api/v1/test-evidence")
public class TestEvidenceController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final TestEvidenceService testEvidenceService;
    private final TenantResolver tenantResolver;

    public TestEvidenceController(
            TestEvidenceService testEvidenceService,
            TenantResolver tenantResolver
    ) {
        this.testEvidenceService = testEvidenceService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<TestEvidenceDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String testRunId,
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
        TestEvidenceType typeEnum = parseType(type);
        Page<TestEvidenceDto> result = testEvidenceService.list(
                tenantId, typeEnum, testRunId, pageable);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<TestEvidenceDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(testEvidenceService.get(tenantId, id));
    }

    @PostMapping
    public ApiResponse<TestEvidenceDto> create(
            @Valid @RequestBody TestEvidenceCreateRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(testEvidenceService.create(tenantId, request));
    }

    @PostMapping("/verify")
    public ApiResponse<TestEvidenceVerifyResult> verify(
            @Valid @RequestBody TestEvidenceVerifyRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(testEvidenceService.verify(tenantId, request));
    }

    private TestEvidenceType parseType(String type) {
        if (type == null || type.isBlank()) {
            return null;
        }
        try {
            return TestEvidenceType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
