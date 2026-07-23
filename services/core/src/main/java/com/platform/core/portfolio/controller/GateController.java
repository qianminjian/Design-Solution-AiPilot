package com.platform.core.portfolio.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.DecideGateRequest;
import com.platform.core.portfolio.dto.GateDecisionDto;
import com.platform.core.portfolio.service.GateService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * 门禁决策 REST API
 * 嵌套在项目下，路径：/api/v1/projects/{projectId}/gates
 */
@RestController
@RequestMapping("/api/v1/projects/{projectId}/gates")
public class GateController {

    private final GateService gateService;
    private final TenantResolver tenantResolver;

    public GateController(GateService gateService, TenantResolver tenantResolver) {
        this.gateService = gateService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 列出项目所有门禁（按创建时间倒序）
     */
    @GetMapping
    public ApiResponse<List<GateDecisionDto>> list(
            @PathVariable UUID projectId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        List<GateDecisionDto> gates = gateService.listGates(tenantId, projectId);
        return ApiResponse.success(gates);
    }

    /**
     * 门禁决策
     * 路径格式：/gates/{gateId}:decide（Google AIP 风格自定义动作）
     */
    @PostMapping("/{gateId}:decide")
    public ApiResponse<GateDecisionDto> decide(
            @PathVariable UUID projectId,
            @PathVariable UUID gateId,
            @Valid @RequestBody DecideGateRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        GateDecisionDto dto = gateService.decideGate(tenantId, projectId, gateId, request);
        return ApiResponse.success(dto);
    }
}
