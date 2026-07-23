package com.platform.core.workflow.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.DecideGateRequest;
import com.platform.core.portfolio.dto.GateDecisionDto;
import com.platform.core.portfolio.dto.ProjectBaselineDto;
import com.platform.core.portfolio.dto.StageInstanceDto;
import com.platform.core.portfolio.dto.TransitionStageRequest;
import com.platform.core.workflow.service.StageWorkflowService;
import com.platform.core.workflow.service.WorkflowBaselineService;
import com.platform.core.workflow.service.WorkflowGateService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
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
 * 工作流 REST API
 * 独立路径（不嵌套在 project 下），与 portfolio 模块解耦
 * 路径：/api/v1/workflow/{stages|gates|baselines}
 */
@RestController
@RequestMapping("/api/v1/workflow")
public class WorkflowController {

    private final StageWorkflowService stageWorkflowService;
    private final WorkflowGateService gateService;
    private final WorkflowBaselineService baselineService;
    private final TenantResolver tenantResolver;

    public WorkflowController(StageWorkflowService stageWorkflowService,
                             WorkflowGateService gateService,
                             WorkflowBaselineService baselineService,
                             TenantResolver tenantResolver) {
        this.stageWorkflowService = stageWorkflowService;
        this.gateService = gateService;
        this.baselineService = baselineService;
        this.tenantResolver = tenantResolver;
    }

    // ── 阶段实例 ──

    /** 列出项目所有阶段，支持按状态与阶段编码过滤 */
    @GetMapping("/stages")
    public ApiResponse<List<StageInstanceDto>> listStages(
            @RequestParam UUID projectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String stageCode,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(stageWorkflowService.listStageInstances(tenantId, projectId, status, stageCode));
    }

    /** 阶段状态流转 */
    @PostMapping("/stages/{stageId}:transition")
    public ApiResponse<StageInstanceDto> transitionStage(
            @PathVariable UUID stageId,
            @Valid @RequestBody TransitionStageRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(stageWorkflowService.transitionStage(tenantId, stageId, request));
    }

    // ── 门控决策 ──

    /** 列出门控决策，支持按状态与决策结果过滤 */
    @GetMapping("/gates")
    public ApiResponse<List<GateDecisionDto>> listGates(
            @RequestParam UUID stageId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String decision,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(gateService.listGateDecisions(tenantId, stageId, status, decision));
    }

    /** 门控决策（通过/驳回/有条件通过） */
    @PostMapping("/gates/{gateId}:decide")
    public ApiResponse<GateDecisionDto> decideGate(
            @PathVariable UUID gateId,
            @Valid @RequestBody DecideGateRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(gateService.decideGate(tenantId, gateId, request));
    }

    // ── 项目基线 ──

    /** 列出项目所有基线（按版本号降序） */
    @GetMapping("/baselines")
    public ApiResponse<List<ProjectBaselineDto>> listBaselines(
            @RequestParam UUID projectId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(baselineService.listBaselines(tenantId, projectId));
    }

    /** 获取基线详情 */
    @GetMapping("/baselines/{baselineId}")
    public ApiResponse<ProjectBaselineDto> getBaseline(
            @PathVariable UUID baselineId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(baselineService.getBaseline(tenantId, baselineId));
    }

    /** 冻结基线（DRAFT → FROZEN） */
    @PostMapping("/baselines/{baselineId}:freeze")
    public ApiResponse<ProjectBaselineDto> freezeBaseline(
            @PathVariable UUID baselineId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(baselineService.freezeBaseline(tenantId, baselineId));
    }
}
