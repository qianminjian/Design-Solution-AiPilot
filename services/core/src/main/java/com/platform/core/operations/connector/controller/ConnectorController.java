package com.platform.core.operations.connector.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.operations.connector.dto.ConnectorStatusDto;
import com.platform.core.operations.connector.dto.ListConnectorsRequest;
import com.platform.core.operations.connector.service.ConnectorService;
import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import com.platform.core.operations.domain.enums.ConnectorType;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 连接器 Controller（D37.17 运营中心）
 *
 * <p>路由：/api/v1/operations/connectors
 * <ul>
 *   <li>GET    /                       列表查询（支持 type/status/keyword 过滤）</li>
 *   <li>GET    /{id}                   详情查询</li>
 * </ul>
 *
 * <p>注意：ISOLATE/FAILOVER/RECONCILE 等危险动作通过 POST /api/v1/operations/action 统一入口处理，
 * 不在本 Controller 暴露独立端点（对齐 D37.17 §危险动作约束）。
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@RestController
@RequestMapping("/api/v1/operations/connectors")
public class ConnectorController {

    private final ConnectorService connectorService;
    private final TenantResolver tenantResolver;

    public ConnectorController(ConnectorService connectorService, TenantResolver tenantResolver) {
        this.connectorService = connectorService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<ConnectorStatusDto> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);

        ListConnectorsRequest request = new ListConnectorsRequest(
                parseEnum(type, ConnectorType.class),
                parseEnum(status, ConnectorHealthStatus.class),
                keyword
        );

        Page<ConnectorStatusDto> result = connectorService.listConnectors(tenantId, request);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), 1, result.getContent().size());
    }

    @GetMapping("/{id}")
    public ApiResponse<ConnectorStatusDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        ConnectorStatusDto dto = connectorService.getConnector(tenantId, id);
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
