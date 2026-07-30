package com.platform.core.governance.auditlog.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.governance.auditlog.dto.AuditLogDto;
import com.platform.core.governance.auditlog.dto.AuditLogQuery;
import com.platform.core.governance.auditlog.service.AuditLogService;
import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceResult;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

/**
 * 治理域审计日志 Controller（D37.17 Audit/Evidence）
 *
 * 路由：/api/v1/audit-logs/**
 */
@RestController
@RequestMapping("/api/v1/audit-logs")
public class AuditLogController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "timestamp";

    private final AuditLogService auditLogService;
    private final TenantResolver tenantResolver;

    public AuditLogController(
            AuditLogService auditLogService,
            TenantResolver tenantResolver
    ) {
        this.auditLogService = auditLogService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<AuditLogDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String riskLevel,
            @RequestParam(required = false) String actorId,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false) String traceId,
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

        AuditLogQuery query = new AuditLogQuery(
                parseEnum(category, GovernanceAuditCategory.class),
                parseEnum(result, GovernanceResult.class),
                parseEnum(riskLevel, GovernanceRiskLevel.class),
                actorId,
                from,
                to,
                traceId
        );
        Page<AuditLogDto> resultPage = auditLogService.listAuditLogs(
                tenantId, query, pageable);
        return PageResponse.success(
                resultPage.getContent(),
                resultPage.getTotalElements(),
                safePage,
                safeSize
        );
    }

    @GetMapping("/{id}")
    public ApiResponse<AuditLogDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(auditLogService.getAuditLog(tenantId, id));
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
