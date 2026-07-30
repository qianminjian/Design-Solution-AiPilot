package com.platform.core.analysis.problem.controller;

import com.platform.core.analysis.domain.enums.AnalysisProblemType;
import com.platform.core.analysis.domain.enums.ProblemStatus;
import com.platform.core.analysis.problem.dto.AnalysisProblemDto;
import com.platform.core.analysis.problem.dto.CreateAnalysisProblemRequest;
import com.platform.core.analysis.problem.dto.InvalidateProblemRequest;
import com.platform.core.analysis.problem.dto.ListAnalysisProblemsRequest;
import com.platform.core.analysis.problem.service.AnalysisProblemService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 工程分析问题 Controller（D37.14 P10）
 *
 * <p>路由：/api/v1/analysis/problems
 * <ul>
 *   <li>GET    /                       列表查询（支持 projectId/status/type/keyword 过滤）</li>
 *   <li>GET    /{problemId}            详情查询</li>
 *   <li>POST   /                       创建草稿</li>
 *   <li>PUT    /{problemId}            更新草稿（仅 DRAFT 状态）</li>
 *   <li>DELETE /{problemId}            删除草稿（仅 DRAFT 状态）</li>
 *   <li>POST   /{problemId}/submit     提交就绪（DRAFT → READY）</li>
 *   <li>POST   /{problemId}/invalidate 标记失效（任意状态 → INVALID）</li>
 * </ul>
 *
 * <p>安全约束：
 * <ul>
 *   <li>所有写操作必须携带 x-user-id 头</li>
 *   <li>invalidate 高风险动作必须携带 stepUpToken</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@RestController
@RequestMapping("/api/v1/analysis/problems")
public class AnalysisProblemController {

    private static final int MAX_PAGE_SIZE = 100;

    private final AnalysisProblemService problemService;
    private final TenantResolver tenantResolver;

    public AnalysisProblemController(
            AnalysisProblemService problemService,
            TenantResolver tenantResolver
    ) {
        this.problemService = problemService;
        this.tenantResolver = tenantResolver;
    }

    // ── 查询 ──

    @GetMapping
    public PageResponse<AnalysisProblemDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String projectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String keyword,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

        ListAnalysisProblemsRequest request = new ListAnalysisProblemsRequest(
                projectId,
                keyword,
                parseEnum(status, ProblemStatus.class),
                parseEnum(type, AnalysisProblemType.class),
                safePage,
                safeSize
        );

        Page<AnalysisProblemDto> result = problemService.listProblems(tenantId, request);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{problemId}")
    public ApiResponse<AnalysisProblemDto> get(
            @PathVariable UUID problemId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        AnalysisProblemDto dto = problemService.getProblem(tenantId, problemId);
        return ApiResponse.success(dto);
    }

    // ── 创建/更新/删除 ──

    @PostMapping
    public ApiResponse<AnalysisProblemDto> create(
            @Valid @RequestBody CreateAnalysisProblemRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = problemService.extractCurrentUser(httpRequest);
        AnalysisProblemDto dto = problemService.createProblem(tenantId, currentUser, request);
        return ApiResponse.success(dto);
    }

    @PutMapping("/{problemId}")
    public ApiResponse<AnalysisProblemDto> update(
            @PathVariable UUID problemId,
            @Valid @RequestBody CreateAnalysisProblemRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        AnalysisProblemDto dto = problemService.updateProblem(tenantId, problemId, request);
        return ApiResponse.success(dto);
    }

    @DeleteMapping("/{problemId}")
    public ApiResponse<Void> delete(
            @PathVariable UUID problemId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        problemService.deleteProblem(tenantId, problemId);
        return ApiResponse.success(null);
    }

    // ── 状态流转 ──

    @PostMapping("/{problemId}/submit")
    public ApiResponse<AnalysisProblemDto> submit(
            @PathVariable UUID problemId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = problemService.extractCurrentUser(httpRequest);
        AnalysisProblemDto dto = problemService.submitProblem(tenantId, problemId, currentUser);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{problemId}/invalidate")
    public ApiResponse<AnalysisProblemDto> invalidate(
            @PathVariable UUID problemId,
            @Valid @RequestBody InvalidateProblemRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = problemService.extractCurrentUser(httpRequest);
        AnalysisProblemDto dto = problemService.invalidateProblem(
                tenantId, problemId, currentUser, request);
        return ApiResponse.success(dto);
    }

    // ── 辅助方法 ──

    /**
     * 安全解析枚举参数，非法值返回 null（不抛异常，保持兼容）
     */
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
