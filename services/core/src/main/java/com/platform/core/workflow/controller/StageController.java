package com.platform.core.workflow.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.GateDecisionDto;
import com.platform.core.portfolio.dto.StageInstanceDto;
import com.platform.core.portfolio.dto.TransitionStageRequest;
import com.platform.core.workflow.service.GateService;
import com.platform.core.workflow.service.StageWorkflowService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * 工作流阶段实例 REST API
 *
 * <p>路径设计（对齐 workflow.contract.ts §WorkflowApiPaths）：
 * <ul>
 *   <li>GET  /api/v1/projects/{projectId}/stages - 列出项目阶段（嵌套 project）</li>
 *   <li>POST /api/v1/stages/{stageId}/transition - 阶段流转（不嵌套 project，按 stageId 直达）</li>
 *   <li>GET  /api/v1/stages/{stageId}/gates - 列出阶段关联门禁</li>
 * </ul>
 *
 * <p>与 portfolio.StageController 的区别：
 * <ul>
 *   <li>action 端点直接以资源 ID 为路径前缀（/stages/{id}/transition），不再嵌套在 project 下</li>
 *   <li>列表端点仍嵌套在 project 下，符合 RESTful 资源层级</li>
 * </ul>
 */
@RestController
public class StageController {

    private final StageWorkflowService stageWorkflowService;
    private final GateService gateService;
    private final TenantResolver tenantResolver;

    public StageController(StageWorkflowService stageWorkflowService,
                           GateService gateService,
                           TenantResolver tenantResolver) {
        this.stageWorkflowService = stageWorkflowService;
        this.gateService = gateService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 列出项目所有阶段（按 stage_order 升序）
     * 支持按 status / stageCode 过滤
     */
    @GetMapping("/api/v1/projects/{projectId}/stages")
    public ApiResponse<List<StageInstanceDto>> list(
            @PathVariable UUID projectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String stageCode,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        List<StageInstanceDto> stages = stageWorkflowService.listStageInstances(
                tenantId, projectId, status, stageCode);
        return ApiResponse.success(stages);
    }

    /**
     * 阶段状态流转
     * 路径格式：/api/v1/stages/{stageId}/transition（按 stageId 直达，不嵌套 project）
     */
    @PostMapping("/api/v1/stages/{stageId}/transition")
    public ApiResponse<StageInstanceDto> transition(
            @PathVariable UUID stageId,
            @Valid @RequestBody TransitionStageRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        StageInstanceDto dto = stageWorkflowService.transitionStage(tenantId, stageId, request);
        return ApiResponse.success(dto);
    }

    /**
     * 列出阶段关联的门禁决策（按创建时间倒序）
     * 路径格式：/api/v1/stages/{stageId}/gates
     * 支持按 status / decision 过滤
     */
    @GetMapping("/api/v1/stages/{stageId}/gates")
    public ApiResponse<List<GateDecisionDto>> listGates(
            @PathVariable UUID stageId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String decision,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        List<GateDecisionDto> gates = gateService.listGateDecisions(
                tenantId, stageId, status, decision);
        return ApiResponse.success(gates);
    }
}
