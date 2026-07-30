package com.platform.core.governance.dataasset.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.governance.dataasset.dto.DataAssetActionRequest;
import com.platform.core.governance.dataasset.dto.DataAssetDto;
import com.platform.core.governance.dataasset.service.DataAssetService;
import com.platform.core.governance.domain.enums.GovernanceDataAssetStatus;
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
 * 治理域数据资产 Controller（D37.17 Data Governance）
 *
 * 路由：/api/v1/data-assets/**
 */
@RestController
@RequestMapping("/api/v1/data-assets")
public class DataAssetController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "lastModified";

    private final DataAssetService dataAssetService;
    private final TenantResolver tenantResolver;

    public DataAssetController(
            DataAssetService dataAssetService,
            TenantResolver tenantResolver
    ) {
        this.dataAssetService = dataAssetService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<DataAssetDto> list(
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
        GovernanceDataAssetStatus statusEnum = parseStatus(status);
        Page<DataAssetDto> result = dataAssetService.listDataAssets(
                tenantId, statusEnum, pageable);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<DataAssetDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(dataAssetService.getDataAsset(tenantId, id));
    }

    @PostMapping("/{id}/actions")
    public ApiResponse<DataAssetDto> actOnDataAsset(
            @PathVariable UUID id,
            @Valid @RequestBody DataAssetActionRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(
                dataAssetService.actOnDataAsset(tenantId, id, request, httpRequest));
    }

    private GovernanceDataAssetStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return GovernanceDataAssetStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
