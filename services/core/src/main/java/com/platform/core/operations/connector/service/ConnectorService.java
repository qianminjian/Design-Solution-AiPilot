package com.platform.core.operations.connector.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.operations.connector.domain.ConnectorStatus;
import com.platform.core.operations.connector.dto.ConnectorStatusDto;
import com.platform.core.operations.connector.dto.ListConnectorsRequest;
import com.platform.core.operations.connector.repository.ConnectorStatusRepository;
import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 连接器服务（D37.17 运营中心）
 *
 * <p>核心操作：
 * <ul>
 *   <li>listConnectors：按租户/类型/状态/关键字查询
 *   <li>getConnector：单条详情
 *   <li>isolateConnector：隔离连接器（由 OperationsActionService 调用，状态置为 DISCONNECTED）
 *   <li>reconcileConnector：对账连接器（由 OperationsActionService 调用，触发健康检查）
 *   <li>failoverConnector：故障转移（由 OperationsActionService 调用，V0 占位：标记状态）
 * </ul>
 *
 * <p>安全红线（D37.17 §Operations 危险动作）：
 * <ul>
 *   <li>ISOLATE/FAILOVER/RECONCILE 由 OperationsActionService.executeAction 处理（需 stepUpToken）
 *   <li>建筑 AI Provider（AI_PROVIDER 类型）受 OD-05 ManualHandoff 约束，V1 不可自动调用
 *   <li>跨 Region 操作需校验数据驻留约束
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D44-部署拓扑-Hybrid-Site.md
 * @design D29-可观测性-合规性-指标.md（RED / USE 指标）
 */
@Service
public class ConnectorService {

    private static final Logger log = LoggerFactory.getLogger(ConnectorService.class);

    private final ConnectorStatusRepository repository;

    public ConnectorService(ConnectorStatusRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Page<ConnectorStatusDto> listConnectors(UUID tenantId, ListConnectorsRequest request) {
        Pageable pageable = PageRequest.of(0, 100, Sort.by(Sort.Direction.DESC, "lastUsedAt"));

        Specification<ConnectorStatus> spec = (root, query, cb) ->
                cb.equal(root.get("tenantId"), tenantId);

        if (request.type() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("type"), request.type()));
        }
        if (request.status() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("status"), request.status()));
        }
        if (request.keyword() != null && !request.keyword().isBlank()) {
            String pattern = "%" + request.keyword().toLowerCase() + "%";
            spec = spec.and((root, query, cb) ->
                    cb.or(
                            cb.like(cb.lower(root.get("name")), pattern),
                            cb.like(cb.lower(root.get("connectorCode")), pattern)
                    ));
        }

        return repository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public ConnectorStatusDto getConnector(UUID tenantId, UUID id) {
        ConnectorStatus entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ConnectorStatus not found: " + id));
        return toDto(entity);
    }

    /** 隔离连接器（由 OperationsActionService 调用，状态置为 DISCONNECTED） */
    @Transactional
    public ConnectorStatusDto isolateConnector(UUID tenantId, UUID id, String reason) {
        ConnectorStatus entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ConnectorStatus not found: " + id));

        entity.setStatus(ConnectorHealthStatus.DISCONNECTED);
        entity.setLastHealthCheckAt(Instant.now());

        ConnectorStatus saved = repository.save(entity);
        log.info("Connector isolated: id={}, tenantId={}, reason={}", id, tenantId, reason);
        return toDto(saved);
    }

    /** 对账连接器（由 OperationsActionService 调用，V0 占位：触发健康检查并恢复状态） */
    @Transactional
    public ConnectorStatusDto reconcileConnector(UUID tenantId, UUID id, String reason) {
        ConnectorStatus entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ConnectorStatus not found: " + id));

        // V0 简化：将状态置为 UNKNOWN，等待下次健康检查恢复
        // V1 实现：调用健康检查端点，根据响应更新状态
        entity.setStatus(ConnectorHealthStatus.UNKNOWN);
        entity.setLastHealthCheckAt(Instant.now());

        ConnectorStatus saved = repository.save(entity);
        log.info("Connector reconcile triggered: id={}, tenantId={}, reason={}", id, tenantId, reason);
        return toDto(saved);
    }

    /** 故障转移连接器（由 OperationsActionService 调用，V0 占位：标记 DISCONNECTED） */
    @Transactional
    public ConnectorStatusDto failoverConnector(UUID tenantId, UUID id, String reason) {
        ConnectorStatus entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ConnectorStatus not found: " + id));

        // V0 简化：将状态置为 DISCONNECTED，触发流量切换到备用连接器
        // V1 实现：调用负载均衡器执行实际故障转移
        entity.setStatus(ConnectorHealthStatus.DISCONNECTED);
        entity.setLastHealthCheckAt(Instant.now());

        ConnectorStatus saved = repository.save(entity);
        log.info("Connector failover triggered: id={}, tenantId={}, reason={}", id, tenantId, reason);
        return toDto(saved);
    }

    private ConnectorStatusDto toDto(ConnectorStatus entity) {
        return new ConnectorStatusDto(
                entity.getId(),
                entity.getName(),
                entity.getType(),
                entity.getStatus(),
                entity.getCallCount1h(),
                entity.getErrorCount1h(),
                entity.getAvgLatencyMs(),
                entity.getLicenseRemaining(),
                entity.getLastUsedAt(),
                entity.isManualHandoff()
        );
    }
}
