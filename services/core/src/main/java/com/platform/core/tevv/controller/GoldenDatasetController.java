package com.platform.core.tevv.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.tevv.dto.CreateDatasetRequest;
import com.platform.core.tevv.dto.GoldenDatasetDto;
import com.platform.core.tevv.service.GoldenDatasetService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * 金样数据集 API
 */
@RestController
@RequestMapping("/api/v1/golden-datasets")
public class GoldenDatasetController {

    private final GoldenDatasetService datasetService;

    public GoldenDatasetController(GoldenDatasetService datasetService) {
        this.datasetService = datasetService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<GoldenDatasetDto> create(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestBody @Valid CreateDatasetRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        return ApiResponse.success(datasetService.create(tenantId, request, userId));
    }

    @GetMapping
    public ApiResponse<List<GoldenDatasetDto>> list(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ApiResponse.success(datasetService.listByTenant(tenantId));
    }

    @PostMapping("/{datasetId}/freeze")
    public ApiResponse<GoldenDatasetDto> freeze(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID datasetId,
            @RequestHeader("X-User-Id") UUID userId) {
        return ApiResponse.success(datasetService.freeze(tenantId, datasetId, userId));
    }
}
