package com.platform.core.portfolio.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.FreezeBaselineRequest;
import com.platform.core.portfolio.dto.ProjectBaselineDto;
import com.platform.core.portfolio.service.BaselineService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * 项目基线 REST API
 * 嵌套在项目下，路径：/api/v1/projects/{projectId}/baselines
 */
@RestController
@RequestMapping("/api/v1/projects/{projectId}/baselines")
public class BaselineController {

    private final BaselineService baselineService;
    private final TenantResolver tenantResolver;

    public BaselineController(BaselineService baselineService, TenantResolver tenantResolver) {
        this.baselineService = baselineService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 冻结基线
     */
    @PostMapping
    public ResponseEntity<ApiResponse<ProjectBaselineDto>> freeze(
            @PathVariable UUID projectId,
            @Valid @RequestBody FreezeBaselineRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ProjectBaselineDto dto = baselineService.freezeBaseline(tenantId, projectId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    /**
     * 列出项目所有基线（按修订号倒序）
     */
    @GetMapping
    public ApiResponse<List<ProjectBaselineDto>> list(
            @PathVariable UUID projectId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        List<ProjectBaselineDto> baselines = baselineService.listBaselines(tenantId, projectId);
        return ApiResponse.success(baselines);
    }
}
