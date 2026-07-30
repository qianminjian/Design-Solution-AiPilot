package com.platform.core.change.taskplan.controller;

import com.platform.core.change.taskplan.dto.CreateTaskPlanItemRequest;
import com.platform.core.change.taskplan.dto.GenerateTaskPlanRequest;
import com.platform.core.change.taskplan.dto.TaskPlanItemDto;
import com.platform.core.change.taskplan.dto.UpdateTaskPlanItemRequest;
import com.platform.core.change.taskplan.service.TaskPlanItemService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * 处置任务 Controller（D37.16 P12）
 *
 * 路由：/api/v1/changes/{changeId}/task-plans
 *  - GET    /                       列表
 *  - GET    /{id}                   详情
 *  - POST   /                       创建
 *  - PUT    /{id}                   更新
 *  - DELETE /{id}                   删除
 *  - POST   /:generate              基于受影响项自动生成
 *  - POST   /{id}:start            启动任务
 *  - POST   /{id}:complete          完成任务
 *  - POST   /{id}:skip              跳过任务
 *  - POST   /{id}:cancel            取消任务
 */
@RestController
@RequestMapping("/api/v1/changes/{changeId}/task-plans")
public class TaskPlanItemController {

    private final TaskPlanItemService taskPlanItemService;
    private final TenantResolver tenantResolver;

    public TaskPlanItemController(
            TaskPlanItemService taskPlanItemService,
            TenantResolver tenantResolver
    ) {
        this.taskPlanItemService = taskPlanItemService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public ApiResponse<List<TaskPlanItemDto>> list(
            @PathVariable UUID changeId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(taskPlanItemService.listTaskPlanItems(tenantId, changeId));
    }

    @GetMapping("/{id}")
    public ApiResponse<TaskPlanItemDto> get(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(taskPlanItemService.getTaskPlanItem(tenantId, id));
    }

    @PostMapping
    public ApiResponse<TaskPlanItemDto> create(
            @PathVariable UUID changeId,
            @Valid @RequestBody CreateTaskPlanItemRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(
                taskPlanItemService.createTaskPlanItem(tenantId, changeId, request));
    }

    @PutMapping("/{id}")
    public ApiResponse<TaskPlanItemDto> update(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateTaskPlanItemRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(
                taskPlanItemService.updateTaskPlanItem(tenantId, id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        taskPlanItemService.deleteTaskPlanItem(tenantId, id);
        return ApiResponse.success(null);
    }

    @PostMapping("/:generate")
    public ApiResponse<List<TaskPlanItemDto>> generate(
            @PathVariable UUID changeId,
            @Valid @RequestBody GenerateTaskPlanRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(
                taskPlanItemService.generateTaskPlan(tenantId, changeId, request));
    }

    @PostMapping("/{id}:start")
    public ApiResponse<TaskPlanItemDto> start(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(taskPlanItemService.startTaskPlanItem(tenantId, id));
    }

    @PostMapping("/{id}:complete")
    public ApiResponse<TaskPlanItemDto> complete(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String completedBy = resolveOperator(httpRequest);
        return ApiResponse.success(
                taskPlanItemService.completeTaskPlanItem(tenantId, id, completedBy));
    }

    @PostMapping("/{id}:skip")
    public ApiResponse<TaskPlanItemDto> skip(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            @RequestBody SkipRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(
                taskPlanItemService.skipTaskPlanItem(
                        tenantId, id, request.skipReason(), request.skipApprovedBy()));
    }

    @PostMapping("/{id}:cancel")
    public ApiResponse<TaskPlanItemDto> cancel(
            @PathVariable UUID changeId,
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(taskPlanItemService.cancelTaskPlanItem(tenantId, id));
    }

    /** 跳过请求体 */
    public record SkipRequest(
            String skipReason,
            String skipApprovedBy
    ) {
    }

    private String resolveOperator(HttpServletRequest httpRequest) {
        String userId = httpRequest.getHeader("x-user-id");
        if (userId == null || userId.isBlank()) {
            return "system";
        }
        return userId;
    }
}
