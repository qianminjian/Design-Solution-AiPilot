package com.platform.core.analysis.scenario.controller;

import com.platform.core.analysis.scenario.dto.AnalysisScenarioDto;
import com.platform.core.analysis.scenario.dto.CreateAnalysisScenarioRequest;
import com.platform.core.analysis.scenario.service.AnalysisScenarioService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * 分析场景 Controller（D37.14 P10）
 *
 * <p>路由：/api/v1/analysis/problems/{problemId}/scenarios
 * <ul>
 *   <li>GET    /                   列表查询</li>
 *   <li>GET    /{scenarioId}       详情查询</li>
 *   <li>POST   /                   创建场景（AI 推荐须人工确认）</li>
 *   <li>PUT    /{scenarioId}       更新场景</li>
 *   <li>DELETE /{scenarioId}       删除场景</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@RestController
@RequestMapping("/api/v1/analysis/problems/{problemId}/scenarios")
public class AnalysisScenarioController {

    private final AnalysisScenarioService scenarioService;
    private final TenantResolver tenantResolver;

    public AnalysisScenarioController(
            AnalysisScenarioService scenarioService,
            TenantResolver tenantResolver
    ) {
        this.scenarioService = scenarioService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public ApiResponse<List<AnalysisScenarioDto>> list(
            @PathVariable UUID problemId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        List<AnalysisScenarioDto> result = scenarioService.listScenarios(tenantId, problemId);
        return ApiResponse.success(result);
    }

    @GetMapping("/{scenarioId}")
    public ApiResponse<AnalysisScenarioDto> get(
            @PathVariable UUID problemId,
            @PathVariable UUID scenarioId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        AnalysisScenarioDto dto = scenarioService.getScenario(tenantId, problemId, scenarioId);
        return ApiResponse.success(dto);
    }

    @PostMapping
    public ApiResponse<AnalysisScenarioDto> create(
            @PathVariable UUID problemId,
            @Valid @RequestBody CreateAnalysisScenarioRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = scenarioService.extractCurrentUser(httpRequest);
        AnalysisScenarioDto dto = scenarioService.createScenario(
                tenantId, problemId, currentUser, request);
        return ApiResponse.success(dto);
    }

    @PutMapping("/{scenarioId}")
    public ApiResponse<AnalysisScenarioDto> update(
            @PathVariable UUID problemId,
            @PathVariable UUID scenarioId,
            @Valid @RequestBody CreateAnalysisScenarioRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        AnalysisScenarioDto dto = scenarioService.updateScenario(
                tenantId, problemId, scenarioId, request);
        return ApiResponse.success(dto);
    }

    @DeleteMapping("/{scenarioId}")
    public ApiResponse<Void> delete(
            @PathVariable UUID problemId,
            @PathVariable UUID scenarioId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        scenarioService.deleteScenario(tenantId, problemId, scenarioId);
        return ApiResponse.success(null);
    }
}
