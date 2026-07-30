package com.platform.core.analysis.result.controller;

import com.platform.core.analysis.result.dto.AnalysisResultDto;
import com.platform.core.analysis.result.dto.ImpactProposalRequest;
import com.platform.core.analysis.result.dto.ResultQualityAssessmentDto;
import com.platform.core.analysis.result.dto.SubmitQualityAssessmentRequest;
import com.platform.core.analysis.result.service.AnalysisResultService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 分析结果 Controller（D37.14 P10）
 *
 * <p>路由：/api/v1/analysis/results
 * <ul>
 *   <li>GET    /{resultId}                       结果详情</li>
 *   <li>GET    /{resultId}/quality               质量评估详情</li>
 *   <li>POST   /{resultId}/quality-assessment    提交质量评估</li>
 *   <li>POST   /{resultId}/impact-proposal        创建变更影响提案（结果 → 变更域）</li>
 *   <li>POST   /{resultId}/supersede             标记结果被取代</li>
 * </ul>
 *
 * <p>安全约束：
 * <ul>
 *   <li>质量评估 ACCEPT_AS_REVISION/EXCEPTION 决策需注册师签章</li>
 *   <li>所有高风险动作必须携带 stepUpToken</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@RestController
@RequestMapping("/api/v1/analysis/results")
public class AnalysisResultController {

    private final AnalysisResultService resultService;
    private final TenantResolver tenantResolver;

    public AnalysisResultController(
            AnalysisResultService resultService,
            TenantResolver tenantResolver
    ) {
        this.resultService = resultService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping("/{resultId}")
    public ApiResponse<AnalysisResultDto> get(
            @PathVariable UUID resultId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        AnalysisResultDto dto = resultService.getResult(tenantId, resultId);
        return ApiResponse.success(dto);
    }

    @GetMapping("/{resultId}/quality")
    public ApiResponse<ResultQualityAssessmentDto> getQuality(
            @PathVariable UUID resultId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ResultQualityAssessmentDto dto = resultService.getQualityAssessment(tenantId, resultId);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{resultId}/quality-assessment")
    public ApiResponse<ResultQualityAssessmentDto> submitQualityAssessment(
            @PathVariable UUID resultId,
            @Valid @RequestBody SubmitQualityAssessmentRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = resultService.extractCurrentUser(httpRequest);
        ResultQualityAssessmentDto dto = resultService.submitQualityAssessment(
                tenantId, resultId, currentUser, request);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{resultId}/impact-proposal")
    public ApiResponse<Map<String, UUID>> createImpactProposal(
            @PathVariable UUID resultId,
            @Valid @RequestBody ImpactProposalRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = resultService.extractCurrentUser(httpRequest);
        UUID proposalId = resultService.createImpactProposal(
                tenantId, resultId, currentUser, request);
        return ApiResponse.success(Map.of("proposalId", proposalId));
    }

    @PostMapping("/{resultId}/supersede")
    public ApiResponse<AnalysisResultDto> supersede(
            @PathVariable UUID resultId,
            @RequestBody java.util.Map<String, UUID> body,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = resultService.extractCurrentUser(httpRequest);
        UUID supersededBy = body.get("supersededBy");
        AnalysisResultDto dto = resultService.supersedeResult(
                tenantId, resultId, supersededBy, currentUser);
        return ApiResponse.success(dto);
    }
}
