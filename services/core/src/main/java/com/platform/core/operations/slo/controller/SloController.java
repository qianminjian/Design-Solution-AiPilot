package com.platform.core.operations.slo.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.operations.domain.enums.SloStatus;
import com.platform.core.operations.slo.dto.SloTargetDto;
import com.platform.core.operations.slo.service.SloService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * SLO Controller（D37.17 运营中心）
 *
 * <p>路由：/api/v1/operations/slos
 * <ul>
 *   <li>GET    /                       列表查询（支持 status 过滤）</li>
 *   <li>GET    /{id}                   详情查询</li>
 *   <li>POST   /                       创建 SLO 目标</li>
 *   <li>PUT    /{id}                   更新 SLO 目标</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@RestController
@RequestMapping("/api/v1/operations/slos")
public class SloController {

    private static final int MAX_PAGE_SIZE = 100;

    private final SloService sloService;
    private final TenantResolver tenantResolver;

    public SloController(SloService sloService, TenantResolver tenantResolver) {
        this.sloService = sloService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<SloTargetDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

        Page<SloTargetDto> result = sloService.listSlos(tenantId, parseEnum(status, SloStatus.class), safePage, safeSize);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<SloTargetDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        SloTargetDto dto = sloService.getSlo(tenantId, id);
        return ApiResponse.success(dto);
    }

    @PostMapping
    public ApiResponse<SloTargetDto> create(
            @RequestBody SloTargetDto request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        SloTargetDto dto = sloService.createSlo(tenantId, request);
        return ApiResponse.success(dto);
    }

    @PutMapping("/{id}")
    public ApiResponse<SloTargetDto> update(
            @PathVariable UUID id,
            @RequestBody SloTargetDto request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        SloTargetDto dto = sloService.updateSlo(tenantId, id, request);
        return ApiResponse.success(dto);
    }

    private <E extends Enum<E>> E parseEnum(String value, Class<E> enumClass) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(enumClass, value.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
