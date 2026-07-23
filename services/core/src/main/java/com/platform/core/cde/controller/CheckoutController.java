package com.platform.core.cde.controller;

import com.platform.core.cde.dto.CheckinRequest;
import com.platform.core.cde.dto.CheckoutDto;
import com.platform.core.cde.dto.DocumentVersionDto;
import com.platform.core.cde.service.CheckoutService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 文档检入检出 REST API
 * 路径：/api/v1/documents/{id}/checkout + /api/v1/documents/{id}/checkin
 * 对齐 cde.contract.ts §CdeApiPaths.checkout / checkin
 */
@RestController
@RequestMapping("/api/v1/documents/{documentId}")
public class CheckoutController {

    private final CheckoutService checkoutService;
    private final TenantResolver tenantResolver;

    public CheckoutController(CheckoutService checkoutService, TenantResolver tenantResolver) {
        this.checkoutService = checkoutService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 检出文档（DRAFT/PUBLISHED → CHECKED_OUT）
     * POST /api/v1/documents/{documentId}/checkout
     */
    @PostMapping("/checkout")
    public ApiResponse<CheckoutDto> checkout(
            @PathVariable UUID documentId, HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        CheckoutDto dto = checkoutService.checkout(tenantId, documentId);
        return ApiResponse.success(dto);
    }

    /**
     * 检入文档（CHECKED_OUT → PUBLISHED，创建新 PUBLISHED 版本）
     * POST /api/v1/documents/{documentId}/checkin
     */
    @PostMapping("/checkin")
    public ApiResponse<DocumentVersionDto> checkin(
            @PathVariable UUID documentId,
            @Valid @RequestBody CheckinRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        DocumentVersionDto dto = checkoutService.checkin(tenantId, documentId, request);
        return ApiResponse.success(dto);
    }
}
