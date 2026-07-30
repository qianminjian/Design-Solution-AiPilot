package com.platform.core.governance.restore.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.governance.domain.enums.GovernanceRestoreDrillStatus;
import com.platform.core.governance.restore.dto.RestoreDrillCreateRequest;
import com.platform.core.governance.restore.dto.RestoreDrillDto;
import com.platform.core.governance.restore.service.RestoreDrillService;
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

/**
 * 治理域灾备演练 Controller（D37.17 灾备演练）
 *
 * 路由：/api/v1/restore-drills/**
 */
@RestController
@RequestMapping("/api/v1/restore-drills")
public class RestoreDrillController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "startedAt";

    private final RestoreDrillService restoreDrillService;
    private final TenantResolver tenantResolver;

    public RestoreDrillController(
            RestoreDrillService restoreDrillService,
            TenantResolver tenantResolver
    ) {
        this.restoreDrillService = restoreDrillService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<RestoreDrillDto> list(
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
        GovernanceRestoreDrillStatus statusEnum = parseStatus(status);
        Page<RestoreDrillDto> result = restoreDrillService.listRestoreDrills(
                tenantId, statusEnum, pageable);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<RestoreDrillDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(restoreDrillService.getRestoreDrill(tenantId, id));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RestoreDrillDto>> create(
            @Valid @RequestBody RestoreDrillCreateRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        RestoreDrillDto dto = restoreDrillService.createRestoreDrill(tenantId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    private GovernanceRestoreDrillStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return GovernanceRestoreDrillStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
