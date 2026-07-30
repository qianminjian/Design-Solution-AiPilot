package com.platform.core.operations.queue.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.operations.domain.enums.QueueTaskPriority;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.domain.enums.QueueTaskType;
import com.platform.core.operations.queue.dto.FailTaskRequest;
import com.platform.core.operations.queue.dto.ListQueueTasksRequest;
import com.platform.core.operations.queue.dto.QueueTaskDto;
import com.platform.core.operations.queue.service.QueueTaskService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 队列任务 Controller（D37.17 运营中心）
 *
 * <p>路由：/api/v1/operations/queue
 * <ul>
 *   <li>GET    /                       列表查询（支持 status/type/priority/workerId/keyword 过滤）</li>
 *   <li>GET    /{id}                   详情查询</li>
 *   <li>POST   /                       创建任务</li>
 *   <li>POST   /{id}/claim             Worker 领取任务（QUEUED → RUNNING）</li>
 *   <li>POST   /{id}/complete          Worker 完成任务（RUNNING → COMPLETED）</li>
 *   <li>POST   /{id}/fail              Worker 上报失败（RUNNING → FAILED）</li>
 *   <li>POST   /{id}/pause             暂停任务</li>
 *   <li>POST   /{id}/resume            恢复任务</li>
 *   <li>POST   /{id}/retry             重试任务（检测 retry storm）</li>
 *   <li>POST   /{id}/cancel            取消任务</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@RestController
@RequestMapping("/api/v1/operations/queue")
public class QueueTaskController {

    private static final int MAX_PAGE_SIZE = 100;

    private final QueueTaskService queueTaskService;
    private final TenantResolver tenantResolver;

    public QueueTaskController(QueueTaskService queueTaskService, TenantResolver tenantResolver) {
        this.queueTaskService = queueTaskService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<QueueTaskDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) UUID workerId,
            @RequestParam(required = false) String keyword,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

        ListQueueTasksRequest request = new ListQueueTasksRequest(
                parseEnum(status, QueueTaskStatus.class),
                parseEnum(type, QueueTaskType.class),
                parseEnum(priority, QueueTaskPriority.class),
                workerId,
                keyword,
                safePage,
                safeSize
        );

        Page<QueueTaskDto> result = queueTaskService.listQueueTasks(tenantId, request);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<QueueTaskDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        QueueTaskDto dto = queueTaskService.getQueueTask(tenantId, id);
        return ApiResponse.success(dto);
    }

    @PostMapping
    public ApiResponse<QueueTaskDto> create(
            @RequestBody QueueTaskDto request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        QueueTaskDto dto = queueTaskService.createQueueTask(tenantId, request);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/claim")
    public ApiResponse<QueueTaskDto> claim(
            @PathVariable UUID id,
            @RequestParam UUID workerId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        QueueTaskDto dto = queueTaskService.claimTask(tenantId, id, workerId);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/complete")
    public ApiResponse<QueueTaskDto> complete(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        QueueTaskDto dto = queueTaskService.completeTask(tenantId, id);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/fail")
    public ApiResponse<QueueTaskDto> fail(
            @PathVariable UUID id,
            @RequestBody FailTaskRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        QueueTaskDto dto = queueTaskService.failTask(tenantId, id, request.errorMessage());
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/pause")
    public ApiResponse<QueueTaskDto> pause(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        QueueTaskDto dto = queueTaskService.pauseTask(tenantId, id);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/resume")
    public ApiResponse<QueueTaskDto> resume(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        QueueTaskDto dto = queueTaskService.resumeTask(tenantId, id);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/retry")
    public ApiResponse<QueueTaskDto> retry(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        QueueTaskDto dto = queueTaskService.retryTask(tenantId, id);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<QueueTaskDto> cancel(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        QueueTaskDto dto = queueTaskService.cancelTask(tenantId, id);
        return ApiResponse.success(dto);
    }

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
