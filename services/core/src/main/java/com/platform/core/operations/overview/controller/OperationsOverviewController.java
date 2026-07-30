package com.platform.core.operations.overview.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.operations.overview.dto.OperationsOverviewDto;
import com.platform.core.operations.overview.service.OperationsOverviewService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Operations 概览 Controller（D37.17 运营中心）
 *
 * <p>路由：/api/v1/operations/overview
 * <ul>
 *   <li>GET /              聚合统计（Queue/Worker/Connector/SLO）</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@RestController
@RequestMapping("/api/v1/operations/overview")
public class OperationsOverviewController {

    private final OperationsOverviewService overviewService;
    private final TenantResolver tenantResolver;

    public OperationsOverviewController(
            OperationsOverviewService overviewService,
            TenantResolver tenantResolver
    ) {
        this.overviewService = overviewService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public ApiResponse<OperationsOverviewDto> getOverview(HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        OperationsOverviewDto dto = overviewService.getOverview(tenantId);
        return ApiResponse.success(dto);
    }
}
