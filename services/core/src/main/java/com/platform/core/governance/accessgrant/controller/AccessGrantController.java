package com.platform.core.governance.accessgrant.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.governance.accessgrant.dto.AccessGrantActionRequest;
import com.platform.core.governance.accessgrant.dto.AccessGrantDto;
import com.platform.core.governance.accessgrant.service.AccessGrantService;
import com.platform.core.governance.domain.enums.GovernanceAccessGrantStatus;
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
 * 治理域访问授权 Controller（D37.17 Access Review）
 *
 * 路由：/api/v1/access-grants/**
 *  - GET    /                列表（支持 status 过滤）
 *  - GET    /{id}            详情
 *  - POST   /{id}/actions    执行 approve/shorten/revoke 操作
 */
@RestController
@RequestMapping("/api/v1/access-grants")
public class AccessGrantController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "grantedAt";

    private final AccessGrantService accessGrantService;
    private final TenantResolver tenantResolver;

    public AccessGrantController(
            AccessGrantService accessGrantService,
            TenantResolver tenantResolver
    ) {
        this.accessGrantService = accessGrantService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<AccessGrantDto> list(
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
        GovernanceAccessGrantStatus statusEnum = parseStatus(status);
        Page<AccessGrantDto> result = accessGrantService.listAccessGrants(
                tenantId, statusEnum, pageable);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<AccessGrantDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        AccessGrantDto dto = accessGrantService.getAccessGrant(tenantId, id);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/actions")
    public ApiResponse<AccessGrantDto> actOnGrant(
            @PathVariable UUID id,
            @Valid @RequestBody AccessGrantActionRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        AccessGrantDto dto = accessGrantService.actOnGrant(
                tenantId, id, request, httpRequest);
        return ApiResponse.success(dto);
    }

    private GovernanceAccessGrantStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return GovernanceAccessGrantStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
