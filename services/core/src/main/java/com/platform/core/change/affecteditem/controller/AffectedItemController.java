package com.platform.core.change.affecteditem.controller;

import com.platform.core.change.affecteditem.dto.AffectedItemDto;
import com.platform.core.change.affecteditem.dto.CreateAffectedItemRequest;
import com.platform.core.change.affecteditem.dto.ListAffectedItemsRequest;
import com.platform.core.change.affecteditem.dto.UpdateAffectedItemRequest;
import com.platform.core.change.affecteditem.service.AffectedItemService;
import com.platform.core.change.domain.enums.AffectedObjectType;
import com.platform.core.change.domain.enums.ImpactLevel;
import com.platform.core.change.domain.enums.RecheckStatus;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.DeleteMapping;
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
 * 受影响项 Controller（D37.16 P12）
 *
 * 路由：/api/v1/changes/{changeId}/affected-items
 *  - GET    /                 列表（支持 type/impact/recheckStatus 过滤）
 *  - GET    /{id}             详情
 *  - POST   /                 手动添加受影响项
 *  - PUT    /{id}             更新受影响项
 *  - DELETE /{id}             删除受影响项
 *  - POST   /{id}:recheck     执行复查
 */
@RestController
@RequestMapping("/api/v1/changes/{changeId}/affected-items")
public class AffectedItemController {

    private static final int MAX_PAGE_SIZE = 200;
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final AffectedItemService affectedItemService;
    private final TenantResolver tenantResolver;

    public AffectedItemController(
            AffectedItemService affectedItemService,
            TenantResolver tenantResolver
    ) {
        this.affectedItemService = affectedItemService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<AffectedItemDto> list(
            @PathVariable UUID changeId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int pageSize,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String impact,
            @RequestParam(required = false) String recheckStatus,
            @RequestParam(required = false) String discipline,
            @RequestParam(required = false) String keyword,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(
                safePage - 1, safeSize, Sort.by(Sort.Direction.ASC, DEFAULT_SORT_FIELD));

        ListAffectedItemsRequest request = new ListAffectedItemsRequest(
                parseType(type),
                parseImpact(impact),
                parseRecheckStatus(recheckStatus),
                discipline,
                keyword,
                safePage,
                safeSize
        );

        Page<AffectedItemDto> result = affectedItemService.listAffectedItems(
                tenantId, changeId, request);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<AffectedItemDto> get(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        AffectedItemDto dto = affectedItemService.getAffectedItem(tenantId, id);
        return ApiResponse.success(dto);
    }

    @PostMapping
    public ApiResponse<AffectedItemDto> create(
            @PathVariable UUID changeId,
            @Valid @RequestBody CreateAffectedItemRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        AffectedItemDto dto = affectedItemService.createAffectedItem(
                tenantId, changeId, request);
        return ApiResponse.success(dto);
    }

    @PutMapping("/{id}")
    public ApiResponse<AffectedItemDto> update(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAffectedItemRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        AffectedItemDto dto = affectedItemService.updateAffectedItem(
                tenantId, id, request);
        return ApiResponse.success(dto);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        affectedItemService.deleteAffectedItem(tenantId, id);
        return ApiResponse.success(null);
    }

    @PostMapping("/{id}:recheck")
    public ApiResponse<AffectedItemDto> recheck(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            @RequestBody RecheckRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String recheckedBy = resolveOperator(httpRequest);
        RecheckStatus recheckStatus = RecheckStatus.valueOf(
                request.recheckStatus().toUpperCase());
        AffectedItemDto dto = affectedItemService.recheckAffectedItem(
                tenantId, id, recheckStatus, recheckedBy, request.comment());
        return ApiResponse.success(dto);
    }

    /** 复查请求体 */
    public record RecheckRequest(
            String recheckStatus,
            String comment
    ) {
    }

    private String resolveOperator(HttpServletRequest httpRequest) {
        String userId = httpRequest.getHeader("x-user-id");
        if (userId == null || userId.isBlank()) {
            return "system";
        }
        return userId;
    }

    private AffectedObjectType parseType(String type) {
        if (type == null || type.isBlank()) {
            return null;
        }
        try {
            return AffectedObjectType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private ImpactLevel parseImpact(String impact) {
        if (impact == null || impact.isBlank()) {
            return null;
        }
        try {
            return ImpactLevel.valueOf(impact.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private RecheckStatus parseRecheckStatus(String recheckStatus) {
        if (recheckStatus == null || recheckStatus.isBlank()) {
            return null;
        }
        try {
            return RecheckStatus.valueOf(recheckStatus.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
