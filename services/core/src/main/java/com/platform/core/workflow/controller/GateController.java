package com.platform.core.workflow.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.DecideGateRequest;
import com.platform.core.portfolio.dto.GateDecisionDto;
import com.platform.core.workflow.service.GateService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 工作流门禁决策 REST API
 *
 * <p>路径设计（对齐 workflow.contract.ts §WorkflowApiPaths）：
 * <ul>
 *   <li>POST /api/v1/gates/{gateId}/decision - 提交门禁决策（按 gateId 直达，不嵌套 project）</li>
 * </ul>
 *
 * <p>与 portfolio.GateController 的区别：
 * <ul>
 *   <li>action 端点直接以资源 ID 为路径前缀（/gates/{id}/decision），不再嵌套在 project 下</li>
 *   <li>门禁列表查询通过 StageController.listGates 提供（/api/v1/stages/{stageId}/gates）</li>
 * </ul>
 */
@RestController
public class GateController {

    private final GateService gateService;
    private final TenantResolver tenantResolver;

    public GateController(GateService gateService, TenantResolver tenantResolver) {
        this.gateService = gateService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 提交门禁决策
     * 路径格式：/api/v1/gates/{gateId}/decision
     *
     * <p>核心不变量：如指定 baselineId，基线必须为 PUBLISHED 状态（由服务层校验）
     */
    @PostMapping("/api/v1/gates/{gateId}/decision")
    public ApiResponse<GateDecisionDto> decide(
            @PathVariable UUID gateId,
            @Valid @RequestBody DecideGateRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        GateDecisionDto dto = gateService.decideGate(tenantId, gateId, request);
        return ApiResponse.success(dto);
    }
}
