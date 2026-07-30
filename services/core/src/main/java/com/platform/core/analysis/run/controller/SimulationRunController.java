package com.platform.core.analysis.run.controller;

import com.platform.core.analysis.domain.enums.RunStatus;
import com.platform.core.analysis.run.dto.CancelRunRequest;
import com.platform.core.analysis.run.dto.ConvergenceMetricDto;
import com.platform.core.analysis.run.dto.CreateSimulationRunRequest;
import com.platform.core.analysis.run.dto.RunTimelineEventDto;
import com.platform.core.analysis.run.dto.SimulationRunDto;
import com.platform.core.analysis.run.service.SimulationRunService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * 模拟运行 Controller（D37.14 P10）
 *
 * <p>路由：/api/v1/analysis/runs
 * <ul>
 *   <li>GET    ?problemId=             按问题查询运行列表</li>
 *   <li>GET    /{runId}                运行详情</li>
 *   <li>POST   /                       创建运行（QUEUED）</li>
 *   <li>POST   /{runId}/cancel         取消运行（高风险动作）</li>
 *   <li>POST   /{runId}/retry          重试运行（高风险动作 + retry storm 检测）</li>
 *   <li>GET    /{runId}/timeline       运行时间线</li>
 *   <li>GET    /{runId}/convergence    收敛指标</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@RestController
@RequestMapping("/api/v1/analysis/runs")
public class SimulationRunController {

    private static final int MAX_PAGE_SIZE = 100;

    private final SimulationRunService runService;
    private final TenantResolver tenantResolver;

    public SimulationRunController(
            SimulationRunService runService,
            TenantResolver tenantResolver
    ) {
        this.runService = runService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<SimulationRunDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) UUID problemId,
            @RequestParam(required = false) String status,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
        RunStatus statusEnum = parseEnum(status, RunStatus.class);

        Page<SimulationRunDto> result = runService.listRuns(
                tenantId, problemId, statusEnum, safePage, safeSize);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{runId}")
    public ApiResponse<SimulationRunDto> get(
            @PathVariable UUID runId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        SimulationRunDto dto = runService.getRun(tenantId, runId);
        return ApiResponse.success(dto);
    }

    @PostMapping
    public ApiResponse<SimulationRunDto> create(
            @Valid @RequestBody CreateSimulationRunRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = runService.extractCurrentUser(httpRequest);
        SimulationRunDto dto = runService.createRun(tenantId, currentUser, request);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{runId}/cancel")
    public ApiResponse<SimulationRunDto> cancel(
            @PathVariable UUID runId,
            @Valid @RequestBody CancelRunRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = runService.extractCurrentUser(httpRequest);
        SimulationRunDto dto = runService.cancelRun(tenantId, runId, currentUser, request);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{runId}/retry")
    public ApiResponse<SimulationRunDto> retry(
            @PathVariable UUID runId,
            @Valid @RequestBody CancelRunRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = runService.extractCurrentUser(httpRequest);
        SimulationRunDto dto = runService.retryRun(tenantId, runId, currentUser, request);
        return ApiResponse.success(dto);
    }

    @GetMapping("/{runId}/timeline")
    public ApiResponse<List<RunTimelineEventDto>> timeline(
            @PathVariable UUID runId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        List<RunTimelineEventDto> result = runService.getRunTimeline(tenantId, runId);
        return ApiResponse.success(result);
    }

    @GetMapping("/{runId}/convergence")
    public ApiResponse<List<ConvergenceMetricDto>> convergence(
            @PathVariable UUID runId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        List<ConvergenceMetricDto> result = runService.getRunConvergence(tenantId, runId);
        return ApiResponse.success(result);
    }

    // ── 辅助方法 ──

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
