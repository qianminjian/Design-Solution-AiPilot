package com.platform.core.operations.connector.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.operations.connector.domain.ConnectorStatus;
import com.platform.core.operations.connector.dto.ConnectorRegisterRequest;
import com.platform.core.operations.connector.dto.ConnectorStatusDto;
import com.platform.core.operations.connector.dto.ListConnectorsRequest;
import com.platform.core.operations.connector.repository.ConnectorStatusRepository;
import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import com.platform.core.operations.domain.enums.ConnectorType;
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
import java.util.Optional;
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
    private final ConnectorHealthChecker healthChecker;

    public ConnectorService(
            ConnectorStatusRepository repository,
            ConnectorHealthChecker healthChecker) {
        this.repository = repository;
        this.healthChecker = healthChecker;
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

    /**
     * 注册连接器（幂等，对齐 WorkerService.register 模式）
     *
     * <p>同一 connectorCode 已存在时更新记录，不存在时新建并初始化状态为 UNKNOWN（待首次健康检查后更新）。
     *
     * <p>安全红线（OD-05 外部 AI 接入约束）：
     * <ul>
     *   <li>AI_PROVIDER 类型强制 isManualHandoff=true（V1 不自动接入建筑 AI Provider）</li>
     *   <li>其他类型按请求传入的 isManualHandoff 字段设置</li>
     * </ul>
     *
     * @param tenantId 租户 ID
     * @param request 注册请求
     * @return 连接器状态 DTO
     */
    @Transactional
    public ConnectorStatusDto register(UUID tenantId, ConnectorRegisterRequest request) {
        Optional<ConnectorStatus> existing = repository.findByTenantIdAndConnectorCode(
                tenantId, request.connectorCode());

        ConnectorStatus entity = existing.orElseGet(ConnectorStatus::new);
        if (existing.isEmpty()) {
            entity.setTenantId(tenantId);
            entity.setConnectorCode(request.connectorCode());
            // 首次注册：状态置 UNKNOWN，等待首次健康检查
            entity.setStatus(ConnectorHealthStatus.UNKNOWN);
            entity.setCallCount1h(0);
            entity.setErrorCount1h(0);
            entity.setAvgLatencyMs(0);
        }
        entity.setName(request.name());
        entity.setType(request.type());
        entity.setRegion(request.region());
        if (request.endpointUrl() != null) {
            entity.setEndpointUrl(request.endpointUrl());
        }
        if (request.licenseRemaining() != null) {
            entity.setLicenseRemaining(request.licenseRemaining());
        }
        // 安全红线：AI_PROVIDER 类型强制 ManualHandoff（OD-05 V1 约束）
        boolean manualHandoff = request.type() == ConnectorType.AI_PROVIDER || request.isManualHandoff();
        entity.setManualHandoff(manualHandoff);
        entity.setLastUsedAt(Instant.now());
        entity.setLastHealthCheckAt(existing.isPresent() ? entity.getLastHealthCheckAt() : null);

        ConnectorStatus saved = repository.save(entity);
        log.info("Connector registered: id={}, connectorCode={}, tenantId={}, type={}, manualHandoff={}",
                saved.getId(), saved.getConnectorCode(), tenantId, saved.getType(), saved.isManualHandoff());

        // A-59：注册成功后异步触发健康检查（@Async 独立线程池，不阻塞主流程）
        // 首次注册 status=UNKNOWN，健康检查完成后异步更新为 CONNECTED/DISCONNECTED/DEGRADED
        // AI_PROVIDER 类型由 healthChecker 内部按 OD-05 V1 ManualHandoff 约束跳过自动检查
        healthChecker.checkAsync(
                tenantId,
                saved.getId(),
                saved.getType(),
                saved.getEndpointUrl(),
                saved.getConnectorCode());

        return toDto(saved);
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

    /**
     * 删除连接器（硬删除，V1.10 新增，由 OperationsActionService 双人审批后调用）
     *
     * <p>校验：连接器处于 DISCONNECTED 状态才允许删除，防止误删活跃实例。
     */
    @Transactional
    public void deleteConnector(UUID tenantId, UUID id, String reason) {
        ConnectorStatus entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "ConnectorStatus not found: " + id));

        // 安全校验：连接状态不允许直接删除，需先 isolate/failover
        if (entity.getStatus() == ConnectorHealthStatus.CONNECTED
                || entity.getStatus() == ConnectorHealthStatus.DEGRADED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "Connector 状态为 " + entity.getStatus() + "，需先 isolate 或 failover 后再删除");
        }

        repository.delete(entity);
        log.info("Connector deleted: id={}, tenantId={}, reason={}", id, tenantId, reason);
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
