package com.platform.core.tevv.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.tevv.domain.VerificationStatus;
import com.platform.core.tevv.dto.CreateVerificationItemRequest;
import com.platform.core.tevv.dto.VerificationItemDto;
import com.platform.core.tevv.service.VerificationItemService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * 验证项 API
 */
@RestController
@RequestMapping("/api/v1/verification-items")
public class VerificationItemController {

    private final VerificationItemService itemService;

    public VerificationItemController(VerificationItemService itemService) {
        this.itemService = itemService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<VerificationItemDto> create(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestBody @Valid CreateVerificationItemRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        return ApiResponse.success(itemService.create(tenantId, request, userId));
    }

    @GetMapping
    public ApiResponse<List<VerificationItemDto>> listByDataset(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @RequestParam UUID datasetId) {
        return ApiResponse.success(itemService.listByDataset(tenantId, datasetId));
    }

    @PatchMapping("/{itemId}/status")
    public ApiResponse<VerificationItemDto> updateStatus(
            @RequestHeader("X-Tenant-Id") UUID tenantId,
            @PathVariable UUID itemId,
            @RequestParam VerificationStatus status,
            @RequestParam(required = false) String waiverReason,
            @RequestHeader("X-User-Id") UUID userId) {
        return ApiResponse.success(itemService.updateStatus(tenantId, itemId, status, userId, waiverReason));
    }
}
