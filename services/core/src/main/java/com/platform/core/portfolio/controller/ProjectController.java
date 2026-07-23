package com.platform.core.portfolio.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.CreateProjectRequest;
import com.platform.core.portfolio.dto.ListProjectsRequest;
import com.platform.core.portfolio.dto.ProjectDto;
import com.platform.core.portfolio.dto.UpdateProjectRequest;
import com.platform.core.portfolio.service.ProjectService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 项目 REST API
 * 路径：/api/v1/projects（见 portfolio.contract.ts §PortfolioApiPaths）
 */
@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    /** 默认每页条数上限 */
    private static final int MAX_PAGE_SIZE = 100;
    /** 默认排序字段白名单（防 SQL 注入） */
    private static final String DEFAULT_SORT_FIELD = "createdAt";

    private final ProjectService projectService;
    private final TenantResolver tenantResolver;

    public ProjectController(ProjectService projectService, TenantResolver tenantResolver) {
        this.projectService = projectService;
        this.tenantResolver = tenantResolver;
    }

    /**
     * 创建项目
     */
    @PostMapping
    public ResponseEntity<ApiResponse<ProjectDto>> create(
            @Valid @RequestBody CreateProjectRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ProjectDto dto = projectService.createProject(tenantId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    /**
     * 分页查询项目
     */
    @GetMapping
    public PageResponse<ProjectDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "desc") String order,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
        Sort.Direction direction = "asc".equalsIgnoreCase(order)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(safePage - 1, safeSize, Sort.by(direction, DEFAULT_SORT_FIELD));
        ListProjectsRequest request = new ListProjectsRequest(safePage, safeSize, null, order, status, keyword);
        Page<ProjectDto> result = projectService.listProjects(tenantId, request, pageable);
        return PageResponse.success(result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    /**
     * 查询项目详情
     */
    @GetMapping("/{id}")
    public ApiResponse<ProjectDto> get(@PathVariable UUID id, HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ProjectDto dto = projectService.getProject(tenantId, id);
        return ApiResponse.success(dto);
    }

    /**
     * 部分更新项目
     */
    @PatchMapping("/{id}")
    public ApiResponse<ProjectDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateProjectRequest request,
            HttpServletRequest httpRequest) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ProjectDto dto = projectService.updateProject(tenantId, id, request);
        return ApiResponse.success(dto);
    }
}
