package com.platform.core.change.operation.controller;

import com.platform.core.change.operation.dto.ChangeOperationDto;
import com.platform.core.change.operation.service.ChangeOperationService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * 变更操作阶段 Controller（D37.16 P12）
 *
 * 路由：/api/v1/changes/{changeId}/operations
 *  - GET    /       列表（操作时间线）
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@RestController
@RequestMapping("/api/v1/changes/{changeId}/operations")
public class ChangeOperationController {

    private final ChangeOperationService changeOperationService;
    private final TenantResolver tenantResolver;

    public ChangeOperationController(
            ChangeOperationService changeOperationService,
            TenantResolver tenantResolver
    ) {
        this.changeOperationService = changeOperationService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public ApiResponse<List<ChangeOperationDto>> list(
            @PathVariable UUID changeId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(changeOperationService.listOperations(tenantId, changeId));
    }
}
