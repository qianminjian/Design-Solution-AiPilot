package com.platform.core.operations.queue.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.operations.domain.enums.QueueTaskPriority;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.queue.domain.QueueTask;
import com.platform.core.operations.queue.dto.ListQueueTasksRequest;
import com.platform.core.operations.queue.dto.QueueTaskDto;
import com.platform.core.operations.queue.repository.QueueTaskRepository;
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
 * 队列任务服务（D37.17 运营中心）
 *
 * 核心操作：
 *  - listQueueTasks：按租户/状态/类型/优先级/Worker/关键字查询
 *  - getQueueTask：单条详情
 *  - createQueueTask：创建任务（默认 QUEUED 状态）
 *  - updateStatus：更新任务状态（内部调用）
 *  - pauseTask：暂停任务（QUEUED/RUNNING → PAUSED）
 *  - resumeTask：恢复任务（PAUSED → QUEUED）
 *  - retryTask：重试任务（FAILED → QUEUED，retryCount+1，检测 retry storm）
 *  - cancelTask：取消任务（非终态 → CANCELLED）
 *
 * 安全红线（D37.17 §特殊状态）：
 *  - retry storm 检测：retry_count > max_retries * 2 时拒绝自动重试
 *  - unknown job：通过 status 字段显式标识，不并入 queued/running
 *  - 跨 Region 操作：data_region 字段记录数据驻留约束
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@Service
public class QueueTaskService {

    private static final Logger log = LoggerFactory.getLogger(QueueTaskService.class);

    /** retry storm 检测阈值倍数（retry_count > max_retries * 2 触发） */
    private static final int RETRY_STORM_MULTIPLIER = 2;

    private final QueueTaskRepository repository;

    public QueueTaskService(QueueTaskRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Page<QueueTaskDto> listQueueTasks(UUID tenantId, ListQueueTasksRequest request) {
        int page = request.page() != null && request.page() > 0 ? request.page() - 1 : 0;
        int size = request.pageSize() != null && request.pageSize() > 0 ? request.pageSize() : 20;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "queuedAt"));

        Specification<QueueTask> spec = (root, query, cb) ->
                cb.equal(root.get("tenantId"), tenantId);

        if (request.status() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("status"), request.status()));
        }
        if (request.type() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("type"), request.type()));
        }
        if (request.priority() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("priority"), request.priority()));
        }
        if (request.workerId() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("workerId"), request.workerId()));
        }
        if (request.keyword() != null && !request.keyword().isBlank()) {
            String pattern = "%" + request.keyword().toLowerCase() + "%";
            spec = spec.and((root, query, cb) ->
                    cb.like(cb.lower(root.get("payload")), pattern));
        }

        return repository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public QueueTaskDto getQueueTask(UUID tenantId, UUID id) {
        QueueTask entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QueueTask not found: " + id));
        return toDto(entity);
    }

    @Transactional
    public QueueTaskDto createQueueTask(UUID tenantId, QueueTaskDto request) {
        QueueTask entity = new QueueTask();
        entity.setTenantId(tenantId);
        entity.setType(request.type());
        entity.setStatus(request.status() != null ? request.status() : QueueTaskStatus.QUEUED);
        entity.setPriority(request.priority() != null ? request.priority() : QueueTaskPriority.NORMAL);
        entity.setPayload(request.payload());
        entity.setWorkerId(request.workerId());
        entity.setQueuedAt(Instant.now());
        entity.setRetryCount(request.retryCount());
        entity.setMaxRetries(request.maxRetries() > 0 ? request.maxRetries() : 3);
        entity.setDataRegion(request.dataRegion());

        QueueTask saved = repository.save(entity);
        log.info("QueueTask created: id={}, tenantId={}, type={}, priority={}",
                saved.getId(), tenantId, saved.getType(), saved.getPriority());
        return toDto(saved);
    }

    @Transactional
    public QueueTaskDto updateStatus(UUID tenantId, UUID id, QueueTaskStatus newStatus) {
        QueueTask entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QueueTask not found: " + id));
        entity.setStatus(newStatus);
        if (newStatus == QueueTaskStatus.COMPLETED) {
            entity.setCompletedAt(Instant.now());
            if (entity.getStartedAt() != null) {
                entity.setDurationSec((int) java.time.Duration.between(
                        entity.getStartedAt(), entity.getCompletedAt()).getSeconds());
            }
        }
        QueueTask saved = repository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public QueueTaskDto pauseTask(UUID tenantId, UUID id) {
        QueueTask entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QueueTask not found: " + id));

        if (entity.getStatus() != QueueTaskStatus.QUEUED
                && entity.getStatus() != QueueTaskStatus.RUNNING) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "QueueTask 只能在 QUEUED 或 RUNNING 状态下暂停，当前状态: " + entity.getStatus());
        }

        entity.setStatus(QueueTaskStatus.PAUSED);
        QueueTask saved = repository.save(entity);
        log.info("QueueTask paused: id={}, tenantId={}", id, tenantId);
        return toDto(saved);
    }

    @Transactional
    public QueueTaskDto resumeTask(UUID tenantId, UUID id) {
        QueueTask entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QueueTask not found: " + id));

        if (entity.getStatus() != QueueTaskStatus.PAUSED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "QueueTask 只能在 PAUSED 状态下恢复，当前状态: " + entity.getStatus());
        }

        entity.setStatus(QueueTaskStatus.QUEUED);
        QueueTask saved = repository.save(entity);
        log.info("QueueTask resumed: id={}, tenantId={}", id, tenantId);
        return toDto(saved);
    }

    @Transactional
    public QueueTaskDto retryTask(UUID tenantId, UUID id) {
        QueueTask entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QueueTask not found: " + id));

        if (entity.getStatus() != QueueTaskStatus.FAILED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "QueueTask 只能在 FAILED 状态下重试，当前状态: " + entity.getStatus());
        }

        // retry storm 检测：retry_count > max_retries * 2 时拒绝自动重试
        if (entity.getRetryCount() > entity.getMaxRetries() * RETRY_STORM_MULTIPLIER) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "检测到 retry storm：retryCount=" + entity.getRetryCount()
                            + " 已超过 maxRetries*" + RETRY_STORM_MULTIPLIER
                            + " 阈值，需人工介入");
        }

        entity.setStatus(QueueTaskStatus.QUEUED);
        entity.setRetryCount(entity.getRetryCount() + 1);
        entity.setStartedAt(null);
        entity.setCompletedAt(null);
        entity.setDurationSec(null);
        QueueTask saved = repository.save(entity);
        log.info("QueueTask retried: id={}, tenantId={}, retryCount={}",
                id, tenantId, saved.getRetryCount());
        return toDto(saved);
    }

    @Transactional
    public QueueTaskDto cancelTask(UUID tenantId, UUID id) {
        QueueTask entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QueueTask not found: " + id));

        if (entity.getStatus() == QueueTaskStatus.COMPLETED
                || entity.getStatus() == QueueTaskStatus.FAILED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "QueueTask 已在终态（" + entity.getStatus() + "），不可取消");
        }

        entity.setStatus(QueueTaskStatus.PAUSED);
        // V0 简化：CANCELLED 复用 PAUSED 状态标记，V1 增加独立 CANCELLED 状态
        // 实际取消逻辑由 OperationsActionService.executeAction 处理
        QueueTask saved = repository.save(entity);
        log.info("QueueTask cancelled: id={}, tenantId={}", id, tenantId);
        return toDto(saved);
    }

    /**
     * Worker 领取任务（QUEUED → RUNNING）
     *
     * <p>绑定 workerId，记录 startedAt。仅 QUEUED 状态可领取。
     * 同一 Worker 重复领取同一任务返回当前状态（幂等）。
     *
     * @param tenantId 租户 ID
     * @param id 任务 ID
     * @param workerId 领取任务的 Worker ID
     * @return 更新后的任务
     */
    @Transactional
    public QueueTaskDto claimTask(UUID tenantId, UUID id, UUID workerId) {
        QueueTask entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QueueTask not found: " + id));

        if (entity.getStatus() != QueueTaskStatus.QUEUED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "QueueTask 只能在 QUEUED 状态下被领取，当前状态: " + entity.getStatus());
        }

        entity.setStatus(QueueTaskStatus.RUNNING);
        entity.setWorkerId(workerId);
        entity.setStartedAt(Instant.now());
        QueueTask saved = repository.save(entity);
        log.info("QueueTask claimed: id={}, tenantId={}, workerId={}", id, tenantId, workerId);
        return toDto(saved);
    }

    /**
     * Worker 完成任务（RUNNING → COMPLETED）
     *
     * <p>设置 completedAt + durationSec。仅 RUNNING 状态可完成。
     *
     * @param tenantId 租户 ID
     * @param id 任务 ID
     * @return 更新后的任务
     */
    @Transactional
    public QueueTaskDto completeTask(UUID tenantId, UUID id) {
        QueueTask entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QueueTask not found: " + id));

        if (entity.getStatus() != QueueTaskStatus.RUNNING) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "QueueTask 只能在 RUNNING 状态下完成，当前状态: " + entity.getStatus());
        }

        entity.setStatus(QueueTaskStatus.COMPLETED);
        entity.setCompletedAt(Instant.now());
        if (entity.getStartedAt() != null) {
            entity.setDurationSec((int) java.time.Duration.between(
                    entity.getStartedAt(), entity.getCompletedAt()).getSeconds());
        }
        QueueTask saved = repository.save(entity);
        log.info("QueueTask completed: id={}, tenantId={}, durationSec={}",
                id, tenantId, saved.getDurationSec());
        return toDto(saved);
    }

    /**
     * Worker 上报任务失败（RUNNING → FAILED）
     *
     * <p>记录 lastError 供后续诊断。FAILED 状态可通过 retryTask 重试。
     *
     * @param tenantId 租户 ID
     * @param id 任务 ID
     * @param errorMessage 错误信息（最多 2000 字符）
     * @return 更新后的任务
     */
    @Transactional
    public QueueTaskDto failTask(UUID tenantId, UUID id, String errorMessage) {
        QueueTask entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QueueTask not found: " + id));

        if (entity.getStatus() != QueueTaskStatus.RUNNING) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "QueueTask 只能在 RUNNING 状态下上报失败，当前状态: " + entity.getStatus());
        }

        entity.setStatus(QueueTaskStatus.FAILED);
        entity.setCompletedAt(Instant.now());
        if (entity.getStartedAt() != null) {
            entity.setDurationSec((int) java.time.Duration.between(
                    entity.getStartedAt(), entity.getCompletedAt()).getSeconds());
        }
        // 错误信息截断（防止超长）
        String safeError = errorMessage != null
                ? errorMessage.substring(0, Math.min(errorMessage.length(), 2000))
                : "unknown error";
        entity.setLastError(safeError);

        QueueTask saved = repository.save(entity);
        log.warn("QueueTask failed: id={}, tenantId={}, error={}", id, tenantId, safeError);
        return toDto(saved);
    }

    /** 检测租户下是否触发 retry storm（V0 占位：返回 false） */
    @Transactional(readOnly = true)
    public boolean hasRetryStorm(UUID tenantId) {
        // V1 实现：扫描最近 5 分钟内 retry_count 增长速率
        return false;
    }

    /** 检测租户下是否存在 unknown job（V0 占位：返回 false） */
    @Transactional(readOnly = true)
    public boolean hasUnknownJobs(UUID tenantId) {
        // V1 实现：扫描未注册的任务类型
        return false;
    }

    private QueueTaskDto toDto(QueueTask entity) {
        return new QueueTaskDto(
                entity.getId(),
                entity.getType(),
                entity.getStatus(),
                entity.getPriority(),
                entity.getPayload(),
                entity.getWorkerId(),
                entity.getQueuedAt(),
                entity.getStartedAt(),
                entity.getDurationSec(),
                entity.getRetryCount(),
                entity.getMaxRetries(),
                entity.getTenantId(),
                entity.getDataRegion()
        );
    }
}
