package com.platform.core.operations.worker.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.operations.domain.enums.WorkerRuntimeStatus;
import com.platform.core.operations.domain.enums.WorkerType;
import com.platform.core.operations.worker.domain.WorkerStatus;
import com.platform.core.operations.worker.dto.ListWorkersRequest;
import com.platform.core.operations.worker.dto.WorkerHeartbeatRequest;
import com.platform.core.operations.worker.dto.WorkerRegisterRequest;
import com.platform.core.operations.worker.dto.WorkerStatusDto;
import com.platform.core.operations.worker.repository.WorkerStatusRepository;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Worker 服务（D37.17 运营中心）
 *
 * 核心操作：
 *  - register：Worker 启动时注册（幂等：同一 workerCode 已存在则更新）
 *  - heartbeat：周期性心跳上报（更新状态/资源占用/任务进度）
 *  - listWorkers：按租户/类型/状态/Region/关键字查询
 *  - getWorker：单条详情
 *  - pauseWorker：暂停 Worker（RUNNING/IDLE → STOPPED）
 *  - resumeWorker：恢复 Worker（STOPPED → IDLE）
 *
 * 安全红线（D37.17 §Operations 危险动作）：
 *  - ISOLATE/FAILOVER 由 OperationsActionService.executeAction 处理（需 stepUpToken）
 *  - pause/resume 为中等风险动作，可直接调用
 *  - 已隔离 Worker 不可 resume，需先解除隔离
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D44-部署拓扑-Hybrid-Site.md
 */
@Service
public class WorkerService {

    private static final Logger log = LoggerFactory.getLogger(WorkerService.class);

    /** 心跳超时阈值：超过 90s 未上报视为 stale */
    public static final int HEARTBEAT_TIMEOUT_SEC = 90;

    private final WorkerStatusRepository repository;

    public WorkerService(WorkerStatusRepository repository) {
        this.repository = repository;
    }

    /**
     * 注册 Worker（幂等：同一 workerCode 已存在则更新）
     *
     * <p>Worker 启动时调用，注册成功后状态为 IDLE，等待调度器分配任务。
     *
     * @param tenantId 租户 ID
     * @param request 注册请求
     * @return Worker 状态
     */
    @Transactional
    public WorkerStatusDto register(UUID tenantId, WorkerRegisterRequest request) {
        Optional<WorkerStatus> existing = repository.findByTenantIdAndWorkerCode(
                tenantId, request.workerCode());

        WorkerStatus entity = existing.orElseGet(WorkerStatus::new);
        if (existing.isEmpty()) {
            entity.setTenantId(tenantId);
            entity.setWorkerCode(request.workerCode());
        }
        entity.setType(request.type());
        entity.setRegion(request.region());
        entity.setCustomerSiteWorker(request.isCustomerSiteWorker());
        // 首次注册：状态置 IDLE；已存在则保留原状态（避免重启清空 isolation）
        if (existing.isEmpty()) {
            entity.setStatus(WorkerRuntimeStatus.IDLE);
        }
        entity.setLastHeartbeat(Instant.now());
        // 资源占用初值（请求未提供时默认 0）
        BigDecimal cpu = request.cpuPercent() != null ? request.cpuPercent() : BigDecimal.ZERO;
        BigDecimal mem = request.memoryPercent() != null ? request.memoryPercent() : BigDecimal.ZERO;
        entity.setCpuPercent(cpu);
        entity.setMemoryPercent(mem);
        if (entity.getProcessedCount() == 0 && entity.getFailedCount() == 0) {
            entity.setProcessedCount(0);
            entity.setFailedCount(0);
            entity.setAvgDurationSec(0);
        }

        WorkerStatus saved = repository.save(entity);
        log.info("Worker registered: id={}, workerCode={}, tenantId={}",
                saved.getId(), saved.getWorkerCode(), tenantId);
        return toDto(saved);
    }

    /**
     * Worker 心跳上报
     *
     * <p>更新状态为 RUNNING（有任务时）或 IDLE（无任务时），刷新资源占用与统计。
     * 已隔离 Worker 心跳仅刷新 lastHeartbeat，不改变状态。
     *
     * @param tenantId 租户 ID
     * @param request 心跳请求
     * @return 更新后的 Worker 状态
     */
    @Transactional
    public WorkerStatusDto heartbeat(UUID tenantId, WorkerHeartbeatRequest request) {
        WorkerStatus entity = repository.findByIdAndTenantId(request.id(), tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "WorkerStatus not found: " + request.id()));

        entity.setLastHeartbeat(Instant.now());
        if (request.currentTaskId() != null) {
            entity.setCurrentTaskId(request.currentTaskId());
            entity.setCurrentTaskPayload(request.currentTaskPayload());
            if (!entity.isIsolated()) {
                entity.setStatus(WorkerRuntimeStatus.RUNNING);
            }
        } else {
            entity.setCurrentTaskId(null);
            entity.setCurrentTaskPayload(null);
            if (!entity.isIsolated() && entity.getStatus() == WorkerRuntimeStatus.RUNNING) {
                entity.setStatus(WorkerRuntimeStatus.IDLE);
            }
        }
        entity.setProcessedCount(request.processedCount());
        entity.setFailedCount(request.failedCount());
        entity.setAvgDurationSec(request.avgDurationSec());
        if (request.cpuPercent() != null) {
            entity.setCpuPercent(request.cpuPercent());
        }
        if (request.memoryPercent() != null) {
            entity.setMemoryPercent(request.memoryPercent());
        }

        WorkerStatus saved = repository.save(entity);
        log.debug("Worker heartbeat: id={}, status={}, processedCount={}",
                saved.getId(), saved.getStatus(), saved.getProcessedCount());
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public Page<WorkerStatusDto> listWorkers(UUID tenantId, ListWorkersRequest request) {
        Pageable pageable = PageRequest.of(0, 100, Sort.by(Sort.Direction.DESC, "lastHeartbeat"));

        Specification<WorkerStatus> spec = (root, query, cb) ->
                cb.equal(root.get("tenantId"), tenantId);

        if (request.type() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("type"), request.type()));
        }
        if (request.status() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("status"), request.status()));
        }
        if (request.region() != null && !request.region().isBlank()) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("region"), request.region()));
        }
        if (request.keyword() != null && !request.keyword().isBlank()) {
            String pattern = "%" + request.keyword().toLowerCase() + "%";
            spec = spec.and((root, query, cb) ->
                    cb.like(cb.lower(root.get("workerCode")), pattern));
        }

        return repository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public WorkerStatusDto getWorker(UUID tenantId, UUID id) {
        WorkerStatus entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "WorkerStatus not found: " + id));
        return toDto(entity);
    }

    @Transactional
    public WorkerStatusDto pauseWorker(UUID tenantId, UUID id) {
        WorkerStatus entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "WorkerStatus not found: " + id));

        if (entity.getStatus() != WorkerRuntimeStatus.RUNNING
                && entity.getStatus() != WorkerRuntimeStatus.IDLE) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "Worker 只能在 RUNNING 或 IDLE 状态下暂停，当前状态: " + entity.getStatus());
        }

        if (entity.isIsolated()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "Worker 已隔离，不可直接暂停，需先解除隔离");
        }

        entity.setStatus(WorkerRuntimeStatus.STOPPED);
        WorkerStatus saved = repository.save(entity);
        log.info("Worker paused: id={}, tenantId={}", id, tenantId);
        return toDto(saved);
    }

    @Transactional
    public WorkerStatusDto resumeWorker(UUID tenantId, UUID id) {
        WorkerStatus entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "WorkerStatus not found: " + id));

        if (entity.getStatus() != WorkerRuntimeStatus.STOPPED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "Worker 只能在 STOPPED 状态下恢复，当前状态: " + entity.getStatus());
        }

        if (entity.isIsolated()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "Worker 已隔离，不可恢复，需先解除隔离（通过 OperationsAction RECONCILE）");
        }

        entity.setStatus(WorkerRuntimeStatus.IDLE);
        entity.setLastHeartbeat(Instant.now());
        WorkerStatus saved = repository.save(entity);
        log.info("Worker resumed: id={}, tenantId={}", id, tenantId);
        return toDto(saved);
    }

    /** 隔离 Worker（由 OperationsActionService 调用） */
    @Transactional
    public WorkerStatusDto isolateWorker(UUID tenantId, UUID id, String reason) {
        WorkerStatus entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "WorkerStatus not found: " + id));

        entity.setIsolated(true);
        entity.setIsolatedReason(reason);
        entity.setIsolatedAt(Instant.now());
        entity.setStatus(WorkerRuntimeStatus.STOPPED);
        entity.setCurrentTaskId(null);
        entity.setCurrentTaskPayload(null);

        WorkerStatus saved = repository.save(entity);
        log.info("Worker isolated: id={}, tenantId={}, reason={}", id, tenantId, reason);
        return toDto(saved);
    }

    /** 故障转移 Worker（由 OperationsActionService 调用，V0 占位：标记状态） */
    @Transactional
    public WorkerStatusDto failoverWorker(UUID tenantId, UUID id, String reason) {
        WorkerStatus entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "WorkerStatus not found: " + id));

        // V0 简化：将状态置为 ERROR，触发调度器切换到备用 Worker
        // V1 实现：调用调度器执行实际故障转移
        entity.setStatus(WorkerRuntimeStatus.ERROR);
        entity.setIsolatedReason("FAILOVER: " + reason);
        entity.setIsolatedAt(Instant.now());

        WorkerStatus saved = repository.save(entity);
        log.info("Worker failover triggered: id={}, tenantId={}, reason={}", id, tenantId, reason);
        return toDto(saved);
    }

    private WorkerStatusDto toDto(WorkerStatus entity) {
        return new WorkerStatusDto(
                entity.getId(),
                entity.getType(),
                entity.getStatus(),
                entity.getCurrentTaskId(),
                entity.getCurrentTaskPayload(),
                entity.getProcessedCount(),
                entity.getFailedCount(),
                entity.getAvgDurationSec(),
                entity.getCpuPercent(),
                entity.getMemoryPercent(),
                entity.getLastHeartbeat(),
                entity.getRegion(),
                entity.isCustomerSiteWorker()
        );
    }
}
