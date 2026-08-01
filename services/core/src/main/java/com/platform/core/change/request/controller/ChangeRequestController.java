package com.platform.core.change.request.controller;

import com.platform.core.change.domain.enums.ChangePriority;
import com.platform.core.change.domain.enums.ChangeStatus;
import com.platform.core.change.domain.enums.ChangeType;
import com.platform.core.change.request.dto.ApproveChangeRequestRequest;
import com.platform.core.change.request.dto.ChangeRequestDto;
import com.platform.core.change.request.dto.CreateChangeRequestRequest;
import com.platform.core.change.request.dto.ListChangeRequestsRequest;
import com.platform.core.change.request.dto.RecallChangeRequestRequest;
import com.platform.core.change.request.dto.RejectChangeRequestRequest;
import com.platform.core.change.request.dto.SubmitImpactAssessmentRequest;
import com.platform.core.change.request.dto.VerifyClosureRequest;
import com.platform.core.change.request.service.ChangeRequestService;
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
 * 变更请求 Controller（D37.16 P12 变更影响与闭环工作台）
 *
 * <p>路由：/api/v1/changes
 * <ul>
 *   <li>GET    /                       列表查询（支持 projectId/status/type/priority/keyword 过滤）</li>
 *   <li>GET    /{id}                   详情查询</li>
 *   <li>POST   /                       创建草稿</li>
 *   <li>PUT    /{id}                   更新草稿（仅 DRAFT 状态）</li>
 *   <li>DELETE /{id}                   删除草稿（仅 DRAFT 状态）</li>
 *   <li>POST   /{id}/submit-impact     提交影响评估（DRAFT→PENDING_APPROVAL）</li>
 *   <li>POST   /{id}/approve           批准变更（PENDING_APPROVAL→APPROVED）</li>
 *   <li>POST   /{id}/reject            拒绝变更（PENDING_APPROVAL→REJECTED）</li>
 *   <li>POST   /{id}/recall            撤回变更（非 CLOSED→RECALLED）</li>
 *   <li>POST   /{id}/verify-closure    验证关闭（PENDING_VERIFICATION→CLOSED）</li>
 * </ul>
 *
 * <p>安全约束：
 * <ul>
 *   <li>所有写操作必须携带 x-user-id 头（除创建/更新/删除草稿外）</li>
 *   <li>高风险操作（CRITICAL 优先级 / 批准 / 拒绝 / 撤回 / 验证关闭）必须携带 stepUpToken</li>
 *   <li>批准人 ≠ 发起人 / 关闭人 ≠ 批准人 ≠ 实施人（职责分离）</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@RestController
@RequestMapping("/api/v1/changes")
public class ChangeRequestController {

    private static final int MAX_PAGE_SIZE = 100;

    private final ChangeRequestService changeRequestService;
    private final TenantResolver tenantResolver;

    public ChangeRequestController(
            ChangeRequestService changeRequestService,
            TenantResolver tenantResolver
    ) {
        this.changeRequestService = changeRequestService;
        this.tenantResolver = tenantResolver;
    }

    // ── 查询 ──

    @GetMapping
    public PageResponse<ChangeRequestDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String projectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String keyword,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

        ListChangeRequestsRequest request = new ListChangeRequestsRequest(
                projectId,
                parseEnum(status, ChangeStatus.class),
                parseEnum(type, ChangeType.class),
                parseEnum(priority, ChangePriority.class),
                keyword,
                safePage,
                safeSize
        );

        Page<ChangeRequestDto> result = changeRequestService.listChangeRequests(tenantId, request);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<ChangeRequestDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ChangeRequestDto dto = changeRequestService.getChangeRequest(tenantId, id);
        return ApiResponse.success(dto);
    }

    // ── 创建/更新/删除 ──

    @PostMapping
    public ApiResponse<ChangeRequestDto> create(
            @Valid @RequestBody CreateChangeRequestRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = changeRequestService.extractCurrentUser(httpRequest);
        ChangeRequestDto dto = changeRequestService.createChangeRequest(tenantId, currentUser, request);
        return ApiResponse.success(dto);
    }

    @PutMapping("/{id}")
    public ApiResponse<ChangeRequestDto> update(
            @PathVariable UUID id,
            @Valid @RequestBody CreateChangeRequestRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ChangeRequestDto dto = changeRequestService.updateChangeRequest(tenantId, id, request);
        return ApiResponse.success(dto);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        changeRequestService.deleteChangeRequest(tenantId, id);
        return ApiResponse.success(null);
    }

    // ── 状态流转 ──

    @PostMapping("/{id}/submit-impact")
    public ApiResponse<ChangeRequestDto> submitImpact(
            @PathVariable UUID id,
            @Valid @RequestBody SubmitImpactAssessmentRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = changeRequestService.extractCurrentUser(httpRequest);
        String traceId = httpRequest.getHeader("x-trace-id");
        ChangeRequestDto dto = changeRequestService.submitImpactAssessment(
                tenantId, id, currentUser, traceId, request);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<ChangeRequestDto> approve(
            @PathVariable UUID id,
            @Valid @RequestBody ApproveChangeRequestRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = changeRequestService.extractCurrentUser(httpRequest);
        ChangeRequestDto dto = changeRequestService.approveChangeRequest(
                tenantId, id, currentUser, request);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<ChangeRequestDto> reject(
            @PathVariable UUID id,
            @Valid @RequestBody RejectChangeRequestRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = changeRequestService.extractCurrentUser(httpRequest);
        ChangeRequestDto dto = changeRequestService.rejectChangeRequest(
                tenantId, id, currentUser, request);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/recall")
    public ApiResponse<ChangeRequestDto> recall(
            @PathVariable UUID id,
            @Valid @RequestBody RecallChangeRequestRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = changeRequestService.extractCurrentUser(httpRequest);
        ChangeRequestDto dto = changeRequestService.recallChangeRequest(
                tenantId, id, currentUser, request);
        return ApiResponse.success(dto);
    }

    @PostMapping("/{id}/verify-closure")
    public ApiResponse<ChangeRequestDto> verifyClosure(
            @PathVariable UUID id,
            @Valid @RequestBody VerifyClosureRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        String currentUser = changeRequestService.extractCurrentUser(httpRequest);
        ChangeRequestDto dto = changeRequestService.verifyClosure(
                tenantId, id, currentUser, request);
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
