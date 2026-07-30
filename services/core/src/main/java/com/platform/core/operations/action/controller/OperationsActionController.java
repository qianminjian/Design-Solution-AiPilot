package com.platform.core.operations.action.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.operations.action.dto.OperationsActionRequest;
import com.platform.core.operations.action.dto.OperationsActionResponseDto;
import com.platform.core.operations.action.service.OperationsActionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Operations 主动作 Controller（D37.17 §危险动作）
 *
 * <p>路由：/api/v1/operations/action
 * <ul>
 *   <li>POST /              执行危险动作（isolate/retry/reconcile/failover/pause/resume/cancel）</li>
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
 * @design D37-关键界面-交互状态.md §D37.17
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
}
