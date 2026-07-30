package com.platform.core.analysis.solver.controller;

import com.platform.core.analysis.solver.dto.SolverProfileDto;
import com.platform.core.analysis.solver.service.SolverProfileService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 求解器配置 Controller（D37.14 P10）
 *
 * <p>路由：/api/v1/analysis/solver-profiles
 * <ul>
 *   <li>GET    /                       列表查询（支持 solverType/isActive 过滤）</li>
 *   <li>GET    /{profileId}            详情查询</li>
 * </ul>
 *
 * <p>配置由 V0 阶段 Flyway 种子数据初始化，前端只读。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@RestController
@RequestMapping("/api/v1/analysis/solver-profiles")
public class SolverProfileController {

    private static final int MAX_PAGE_SIZE = 100;

    private final SolverProfileService profileService;
    private final TenantResolver tenantResolver;

    public SolverProfileController(
            SolverProfileService profileService,
            TenantResolver tenantResolver
    ) {
        this.profileService = profileService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<SolverProfileDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String solverType,
            @RequestParam(required = false) Boolean isActive,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

        Page<SolverProfileDto> result = profileService.listProfiles(
                tenantId, solverType, isActive, safePage, safeSize);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{profileId}")
    public ApiResponse<SolverProfileDto> get(
            @PathVariable UUID profileId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        SolverProfileDto dto = profileService.getProfile(tenantId, profileId);
        return ApiResponse.success(dto);
    }
}
