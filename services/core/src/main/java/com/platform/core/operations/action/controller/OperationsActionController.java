package com.platform.core.operations.action.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.operations.action.dto.DualApprovalRequest;
import com.platform.core.operations.action.dto.OperationsActionRequest;
import com.platform.core.operations.action.dto.OperationsActionResponseDto;
import com.platform.core.operations.action.service.OperationsActionService;
import com.platform.core.operations.domain.enums.DualApprovalStatus;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Operations 主动作 Controller（D37.17 §危险动作 + D37.23 §不可逆/合规 双人审批）
 *
 * <p>路由：/api/v1/operations/action
 * <ul>
 *   <li>POST /                                  执行危险动作（isolate/retry/reconcile/failover/pause/resume/cancel）</li>
 *   <li>GET  /pending                           查询待审批操作列表（V1.9.1）</li>
 *   <li>GET  /{actionId}                         查询动作详情（V1.9.1）</li>
 *   <li>GET  /by-operation-id/{operationId}      按字符串 operationId 查询详情（V1.9.1）</li>
 *   <li>POST /{actionId}/review1/approve        审批人 1 批准（V1.9）</li>
 *   <li>POST /{actionId}/review1/reject         审批人 1 拒绝（V1.9）</li>
 *   <li>POST /{actionId}/review2/approve         审批人 2 批准并执行（V1.9）</li>
 *   <li>POST /{actionId}/review2/reject          审批人 2 拒绝（V1.9）</li>
 * </ul>
 *
 * <p>注意：本端点是 Operations 域所有危险动作的统一入口，对应前端 MonitoringApiPaths.action。
 * 通过 actionType + targetType + targetId 三元组分发到对应子域服务。
 *
 * <p>危险动作约束（D37.17 §Operations 危险动作）：
 * <ul>
 *   <li>reason 必填，进入审计日志</li>
 *   <li>stepUpToken：HIGH/IRREVERSIBLE 风险动作必填</li>
 *   <li>impactPreviewAcknowledged：MEDIUM/HIGH/IRREVERSIBLE 必填 true</li>
 * </ul>
 *
 * <p>IRREVERSIBLE 双人审批约束（D37.23 §不可逆/合规，V1.9）：
 * <ul>
 *   <li>审批人 1/2 不可与发起人相同，审批人 2 不可与审批人 1 相同（三人不同原则）</li>
 *   <li>审批人 1/2 必须提供有效 stepUpToken 二次认证</li>
 *   <li>审批意见必填，进入审计日志</li>
 *   <li>两次审批间隔 ≥ 5 秒（防误操作）</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17 + §D37.23
 */
@RestController
@RequestMapping("/api/v1/operations/action")
public class OperationsActionController {

    private final OperationsActionService actionService;
    private final TenantResolver tenantResolver;

    public OperationsActionController(
            OperationsActionService actionService,
            TenantResolver tenantResolver
    ) {
        this.actionService = actionService;
        this.tenantResolver = tenantResolver;
    }

    @PostMapping
    public ApiResponse<OperationsActionResponseDto> execute(
            @Valid @RequestBody OperationsActionRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        OperationsActionResponseDto response = actionService.executeAction(tenantId, request, httpRequest);
        return ApiResponse.success(response);
    }

    /**
     * 审批人 1 批准（V1.9）
     *
     * <p>状态机：PENDING_REVIEW1 → PENDING_REVIEW2
     */
    @PostMapping("/{actionId}/review1/approve")
    public ApiResponse<OperationsActionResponseDto> approveReview1(
            @PathVariable UUID actionId,
            @Valid @RequestBody DualApprovalRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        OperationsActionResponseDto response = actionService.approveReview1(tenantId, actionId, request, httpRequest);
        return ApiResponse.success(response);
    }

    /**
     * 审批人 1 拒绝（V1.9）
     *
     * <p>状态机：PENDING_REVIEW1 → REJECTED_REVIEW1（终态）
     */
    @PostMapping("/{actionId}/review1/reject")
    public ApiResponse<OperationsActionResponseDto> rejectReview1(
            @PathVariable UUID actionId,
            @Valid @RequestBody DualApprovalRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        OperationsActionResponseDto response = actionService.rejectReview1(tenantId, actionId, request, httpRequest);
        return ApiResponse.success(response);
    }

    /**
     * 审批人 2 批准并执行（V1.9）
     *
     * <p>状态机：PENDING_REVIEW2 → APPROVED + 执行实际动作（dispatchAction）
     */
    @PostMapping("/{actionId}/review2/approve")
    public ApiResponse<OperationsActionResponseDto> approveReview2(
            @PathVariable UUID actionId,
            @Valid @RequestBody DualApprovalRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        OperationsActionResponseDto response = actionService.approveReview2(tenantId, actionId, request, httpRequest);
        return ApiResponse.success(response);
    }

    /**
     * 审批人 2 拒绝（V1.9）
     *
     * <p>状态机：PENDING_REVIEW2 → REJECTED_REVIEW2（终态）
     */
    @PostMapping("/{actionId}/review2/reject")
    public ApiResponse<OperationsActionResponseDto> rejectReview2(
            @PathVariable UUID actionId,
            @Valid @RequestBody DualApprovalRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        OperationsActionResponseDto response = actionService.rejectReview2(tenantId, actionId, request, httpRequest);
        return ApiResponse.success(response);
    }

    // ============================================================
    // V1.9.1 查询端点（详情 / 待审批列表）
    // ============================================================

    /**
     * 查询待审批操作列表（V1.9.1）
     *
     * <p>默认查询 PENDING_REVIEW1 + PENDING_REVIEW2 状态，按 initiatedAt 倒序。
     * 审批人可在前端查看待办，进入审批流程。
     *
     * @param statuses   要查询的双人审批状态集合（逗号分隔），默认 "pending_review1,pending_review2"
     * @param page       页码（0-based，默认 0）
     * @param size        每页大小（默认 20，最大 100）
     */
    @GetMapping("/pending")
    public ApiResponse<Page<OperationsActionResponseDto>> listPending(
            @RequestParam(required = false) String statuses,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        // 限制每页最大 100 条
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        PageRequest pageable = PageRequest.of(
                safePage, safeSize, Sort.by(Sort.Direction.DESC, "initiatedAt"));

        Set<DualApprovalStatus> statusSet = parseStatuses(statuses);
        Page<OperationsActionResponseDto> result =
                actionService.listActionsByDualApprovalStatus(tenantId, statusSet, pageable);
        return ApiResponse.success(result);
    }

    /**
     * 查询动作详情（V1.9.1）
     *
     * <p>对应前端 GET /api/v1/operations/action/{actionId}（UUID 主键）。
     */
    @GetMapping("/{actionId}")
    public ApiResponse<OperationsActionResponseDto> getDetail(
            @PathVariable UUID actionId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        OperationsActionResponseDto response = actionService.getActionDetail(tenantId, actionId);
        return ApiResponse.success(response);
    }

    /**
     * 按字符串 operationId 查询详情（V1.9.1）
     *
     * <p>对应前端 GET /api/v1/operations/action/by-operation-id/{operationId}。
     * 前端发起 cancel 后返回 operationId 字符串，使用此端点查询详情。
     */
    @GetMapping("/by-operation-id/{operationId}")
    public ApiResponse<OperationsActionResponseDto> getByOperationId(
            @PathVariable String operationId,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        OperationsActionResponseDto response =
                actionService.getActionByOperationId(tenantId, operationId);
        return ApiResponse.success(response);
    }

    /** 解析 statuses 查询参数为 Set<DualApprovalStatus> */
    private Set<DualApprovalStatus> parseStatuses(String statuses) {
        if (statuses == null || statuses.isBlank()) {
            return Set.of(); // 空集合 → Service 默认 PENDING_REVIEW1 + PENDING_REVIEW2
        }
        return Arrays.stream(statuses.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try {
                        return DualApprovalStatus.valueOf(s.toUpperCase());
                    } catch (IllegalArgumentException ex) {
                        throw new BusinessException(
                                ErrorCode.PARAM_INVALID,
                                HttpStatus.BAD_REQUEST,
                                "未知的双人审批状态: " + s);
                    }
                })
                .collect(Collectors.toSet());
    }
}
