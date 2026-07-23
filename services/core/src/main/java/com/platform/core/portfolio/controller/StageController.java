package com.platform.core.portfolio.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.StageInstanceDto;
import com.platform.core.portfolio.dto.TransitionStageRequest;
import com.platform.core.portfolio.service.StageService;
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
 * 阶段实例 REST API
 * 嵌套在项目下，路径：/api/v1/projects/{projectId}/stages
 */
@RestController
@RequestMapping("/api/v1/projects/{projectId}/stages")
public class StageController {

    private final StageService stageService;
    private final TenantResolver tenantResolver;

    public StageController(StageService stageService, TenantResolver tenantResolver) {
        this.stageService = stageService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 列出项目所有阶段（按 stage_order 升序）
     */
    @GetMapping
    public ApiResponse<List<StageInstanceDto>> list(
            @PathVariable UUID projectId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        List<StageInstanceDto> stages = stageService.listStages(tenantId, projectId);
        return ApiResponse.success(stages);
    }

    /**
     * 阶段状态流转
     * 路径格式：/stages/{stageId}:transition（Google AIP 风格自定义动作）
     */
    @PostMapping("/{stageId}:transition")
    public ApiResponse<StageInstanceDto> transition(
            @PathVariable UUID projectId,
            @PathVariable UUID stageId,
            @Valid @RequestBody TransitionStageRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        StageInstanceDto dto = stageService.transitionStage(tenantId, projectId, stageId, request);
        return ApiResponse.success(dto);
    }
}
