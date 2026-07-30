package com.platform.core.operations.worker.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.operations.domain.enums.WorkerRuntimeStatus;
import com.platform.core.operations.domain.enums.WorkerType;
import com.platform.core.operations.worker.dto.ListWorkersRequest;
import com.platform.core.operations.worker.dto.WorkerHeartbeatRequest;
import com.platform.core.operations.worker.dto.WorkerRegisterRequest;
import com.platform.core.operations.worker.dto.WorkerStatusDto;
import com.platform.core.operations.worker.service.WorkerService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Worker Controller（D37.17 运营中心）
 *
 * <p>路由：/api/v1/operations/workers
 * <ul>
 *   <li>POST   /register               Worker 注册（启动时调用，幂等）</li>
 *   <li>POST   /{id}/heartbeat         心跳上报</li>
 *   <li>GET    /                       列表查询（支持 type/status/region/keyword 过滤）</li>
 *   <li>GET    /{id}                   详情查询</li>
 *   <li>POST   /{id}/pause             暂停 Worker</li>
 *   <li>POST   /{id}/resume            恢复 Worker</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D44-部署拓扑-Hybrid-Site.md
 */
@RestController
@RequestMapping("/api/v1/operations/workers")
public class WorkerController {

    private final WorkerService workerService;
    private final TenantResolver tenantResolver;

    public WorkerController(WorkerService workerService, TenantResolver tenantResolver) {
        this.workerService = workerService;
        this.tenantResolver = tenantResolver;
    }

    @PostMapping("/register")
    public ApiResponse<WorkerStatusDto> register(
            @Valid @RequestBody WorkerRegisterRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        WorkerStatusDto dto = workerService.register(tenantId, request);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/heartbeat")
    public ApiResponse<WorkerStatusDto> heartbeat(
            @PathVariable UUID id,
            @Valid @RequestBody WorkerHeartbeatRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        // 路径 id 与 body id 必须一致（防止误传）
        if (!id.equals(request.id())) {
            throw new IllegalArgumentException(
                    "Path id 与 body id 不一致: path=" + id + ", body=" + request.id());
        }
        WorkerStatusDto dto = workerService.heartbeat(tenantId, request);
        return ApiResponse.success(dto);
    }

    @GetMapping
    public PageResponse<WorkerStatusDto> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String keyword,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);

        ListWorkersRequest request = new ListWorkersRequest(
                parseEnum(type, WorkerType.class),
                parseEnum(status, WorkerRuntimeStatus.class),
                region,
                keyword
        );

        Page<WorkerStatusDto> result = workerService.listWorkers(tenantId, request);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), 1, result.getContent().size());
    }

    @GetMapping("/{id}")
    public ApiResponse<WorkerStatusDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        WorkerStatusDto dto = workerService.getWorker(tenantId, id);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/pause")
    public ApiResponse<WorkerStatusDto> pause(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        WorkerStatusDto dto = workerService.pauseWorker(tenantId, id);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/resume")
    public ApiResponse<WorkerStatusDto> resume(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        WorkerStatusDto dto = workerService.resumeWorker(tenantId, id);
        return ApiResponse.success(dto);
    }

    /** 兼容前端 list 容器：返回 List 而非 Page（前端 ListWorkersRequest 无分页字段） */
    private List<WorkerStatusDto> toList(Page<WorkerStatusDto> page) {
        return page.getContent();
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
