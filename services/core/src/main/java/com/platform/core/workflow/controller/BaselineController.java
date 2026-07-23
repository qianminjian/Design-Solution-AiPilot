package com.platform.core.workflow.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.ProjectBaselineDto;
import com.platform.core.workflow.service.BaselineService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * 工作流项目基线 REST API
 *
 * <p>路径设计（对齐 workflow.contract.ts §WorkflowApiPaths）：
 * <ul>
 *   <li>GET  /api/v1/projects/{projectId}/baselines - 列出项目基线（嵌套 project）</li>
 *   <li>POST /api/v1/baselines/{baselineId}/freeze - 冻结基线（按 baselineId 直达，两步式）</li>
 *   <li>GET  /api/v1/baselines/{baselineId} - 查询基线详情</li>
 * </ul>
 *
 * <p>与 portfolio.BaselineController 的区别：
 * <ul>
 *   <li>freeze 为状态转换（DRAFT → PUBLISHED），不是创建</li>
 *   <li>DRAFT 基线由其他流程创建，本接口只负责冻结</li>
 * </ul>
 */
@RestController
public class BaselineController {

    private final BaselineService baselineService;
    private final TenantResolver tenantResolver;

    public BaselineController(BaselineService baselineService, TenantResolver tenantResolver) {
        this.baselineService = baselineService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 列出项目所有基线（按修订号倒序）
     */
    @GetMapping("/api/v1/projects/{projectId}/baselines")
    public ApiResponse<List<ProjectBaselineDto>> list(
            @PathVariable UUID projectId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        List<ProjectBaselineDto> baselines = baselineService.listBaselines(tenantId, projectId);
        return ApiResponse.success(baselines);
    }

    /**
     * 冻结基线
     * 路径格式：/api/v1/baselines/{baselineId}/freeze
     *
     * <p>业务规则：基线当前状态必须为 DRAFT，冻结后转为 PUBLISHED
     */
    @PostMapping("/api/v1/baselines/{baselineId}/freeze")
    public ResponseEntity<ApiResponse<ProjectBaselineDto>> freeze(
            @PathVariable UUID baselineId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ProjectBaselineDto dto = baselineService.freezeBaseline(tenantId, baselineId);
        return ResponseEntity.status(HttpStatus.OK).body(ApiResponse.success(dto));
    }

    /**
     * 查询基线详情
     * 路径格式：/api/v1/baselines/{baselineId}
     */
    @GetMapping("/api/v1/baselines/{baselineId}")
    public ApiResponse<ProjectBaselineDto> get(
            @PathVariable UUID baselineId,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ProjectBaselineDto dto = baselineService.getBaseline(tenantId, baselineId);
        return ApiResponse.success(dto);
    }
}
