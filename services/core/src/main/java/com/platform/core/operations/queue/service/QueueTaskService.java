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

        // V1.6：兼容 FAILED 和 RETRY_SCHEDULED 状态（手动立即重试，跳过退避等待）
        if (entity.getStatus() != QueueTaskStatus.FAILED
                && entity.getStatus() != QueueTaskStatus.RETRY_SCHEDULED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "QueueTask 只能在 FAILED 或 RETRY_SCHEDULED 状态下重试，当前状态: " + entity.getStatus());
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
        // V1.6：清空重试调度字段
        entity.setNextRetryAt(null);
        entity.setWorkerId(null);
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

        // V1.6：扩展终态校验，DEAD_LETTER 同样为终态
        if (entity.getStatus() == QueueTaskStatus.COMPLETED
                || entity.getStatus() == QueueTaskStatus.FAILED
                || entity.getStatus() == QueueTaskStatus.DEAD_LETTER) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "QueueTask 已在终态（" + entity.getStatus() + "），不可取消");
        }

        entity.setStatus(QueueTaskStatus.PAUSED);
        // V0 简化：CANCELLED 复用 PAUSED 状态标记，V1 增加独立 CANCELLED 状态
        // 实际取消逻辑由 OperationsActionService.executeAction 处理
        // V1.6：清空 RETRY_SCHEDULED 调度字段
        entity.setNextRetryAt(null);
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
     * Worker 上报任务失败（V1.6 自动调度重试或转入死信队列）
     *
     * <p>状态机流转：
     * <ul>
     *   <li>retryCount + 1 &lt; maxRetries：状态切到 RETRY_SCHEDULED，
     *       计算 nextRetryAt = now + 2^(retryCount+1) 秒（指数退避：2s, 4s, 8s, 16s...），
     *       由 WorkerScheduler 定时扫描重置为 QUEUED</li>
     *   <li>retryCount + 1 &gt;= maxRetries：状态切到 DEAD_LETTER（终态），
     *       记录 deadLetteredAt + deadLetterReason，需人工 replay 或删除</li>
     * </ul>
     *
     * <p>安全红线：
     * <ul>
     *   <li>错误信息截断至 2000 字符（lastError）/ 500 字符（retryReason, deadLetterReason）</li>
     *   <li>Worker 调用 failTask 时必须释放占用（workerId 清空）</li>
     *   <li>RETRY_SCHEDULED 是中间态，不并入 QUEUED/RUNNING，对齐 D37.17 §unknown job 显式标识</li>
     * </ul>
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

        // 错误信息截断（防止超长）
        String safeError = errorMessage != null
                ? errorMessage.substring(0, Math.min(errorMessage.length(), 2000))
                : "unknown error";
        String shortReason = safeError.length() > 500
                ? safeError.substring(0, 500)
                : safeError;

        Instant now = Instant.now();
        entity.setCompletedAt(now);
        if (entity.getStartedAt() != null) {
            entity.setDurationSec((int) java.time.Duration.between(
                    entity.getStartedAt(), entity.getCompletedAt()).getSeconds());
        }
        entity.setLastError(safeError);

        // V1.6：自动调度重试或转入死信队列
        int nextRetryCount = entity.getRetryCount() + 1;
        if (nextRetryCount < entity.getMaxRetries()) {
            // 路径 A：进入 RETRY_SCHEDULED 状态，等待 WorkerScheduler 调度
            entity.setRetryCount(nextRetryCount);
            entity.setStatus(QueueTaskStatus.RETRY_SCHEDULED);
            entity.setRetryReason(shortReason);
            // 指数退避：2^nextRetryCount 秒（1->2s, 2->4s, 3->8s...）
            long backoffSeconds = (long) Math.pow(2, nextRetryCount);
            entity.setNextRetryAt(now.plusSeconds(backoffSeconds));
            // 释放 Worker 占用
            entity.setWorkerId(null);
            entity.setStartedAt(null);
            entity.setCompletedAt(null);
            entity.setDurationSec(null);

            QueueTask saved = repository.save(entity);
            log.warn("QueueTask scheduled for retry: id={}, tenantId={}, retryCount={}/{}, nextRetryAt={} (backoff={}s)",
                    id, tenantId, nextRetryCount, entity.getMaxRetries(),
                    entity.getNextRetryAt(), backoffSeconds);
            return toDto(saved);
        } else {
            // 路径 B：达到 maxRetries 阈值，进入死信队列（终态）
            entity.setRetryCount(nextRetryCount);
            entity.setStatus(QueueTaskStatus.DEAD_LETTER);
            entity.setDeadLetteredAt(now);
            entity.setDeadLetterReason("Max retries (" + entity.getMaxRetries()
                    + ") exceeded: " + shortReason);
            // 释放 Worker 占用
            entity.setWorkerId(null);
            entity.setStartedAt(null);
            entity.setCompletedAt(null);
            entity.setDurationSec(null);
            entity.setNextRetryAt(null);

            QueueTask saved = repository.save(entity);
            log.error("QueueTask moved to DEAD_LETTER: id={}, tenantId={}, retryCount={}/{}, reason={}",
                    id, tenantId, nextRetryCount, entity.getMaxRetries(),
                    entity.getDeadLetterReason());
            return toDto(saved);
        }
    }

    /**
     * 重放死信任务（DEAD_LETTER → QUEUED，V1.6 新增）
     *
     * <p>将死信队列中的任务重新入队，重置 retryCount/maxRetries 相关字段，
     * 清空 deadLetteredAt/deadLetterReason/nextRetryAt/retryReason/lastError。
     *
     * @param tenantId 租户 ID
     * @param id 任务 ID
     * @return 更新后的任务
     */
    @Transactional
    public QueueTaskDto replayDeadLetterTask(UUID tenantId, UUID id) {
        QueueTask entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QueueTask not found: " + id));

        if (entity.getStatus() != QueueTaskStatus.DEAD_LETTER) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "QueueTask 只能在 DEAD_LETTER 状态下 replay，当前状态: " + entity.getStatus());
        }

        entity.setStatus(QueueTaskStatus.QUEUED);
        entity.setRetryCount(0);
        entity.setQueuedAt(Instant.now());
        entity.setStartedAt(null);
        entity.setCompletedAt(null);
        entity.setDurationSec(null);
        entity.setWorkerId(null);
        entity.setLastError(null);
        entity.setNextRetryAt(null);
        entity.setRetryReason(null);
        entity.setDeadLetteredAt(null);
        entity.setDeadLetterReason(null);

        QueueTask saved = repository.save(entity);
        log.info("QueueTask replayed from DEAD_LETTER: id={}, tenantId={}", id, tenantId);
        return toDto(saved);
    }

    /**
     * 删除死信任务（仅 DEAD_LETTER 状态可删除，V1.6 新增）
     *
     * <p>硬删除（非软删除）：死信队列中的任务已确认无价值，直接物理删除释放空间。
     * 删除前再次校验状态，防止误删正在运行的任务。
     *
     * @param tenantId 租户 ID
     * @param id 任务 ID
     */
    @Transactional
    public void deleteDeadLetterTask(UUID tenantId, UUID id) {
        QueueTask entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QueueTask not found: " + id));

        if (entity.getStatus() != QueueTaskStatus.DEAD_LETTER) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "QueueTask 只能在 DEAD_LETTER 状态下删除，当前状态: " + entity.getStatus());
        }

        repository.delete(entity);
        log.info("QueueTask deleted from DEAD_LETTER: id={}, tenantId={}", id, tenantId);
    }

    /**
     * 列出死信任务（V1.6 新增）
     *
     * @param tenantId 租户 ID
     * @param page 页码（从 1 开始）
     * @param pageSize 每页大小
     * @return 死信任务分页列表（按 deadLetteredAt 降序）
     */
    @Transactional(readOnly = true)
    public Page<QueueTaskDto> listDeadLetterTasks(UUID tenantId, int page, int pageSize) {
        int safePage = Math.max(0, page - 1);
        int safeSize = Math.min(Math.max(1, pageSize), 100);
        Pageable pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "deadLetteredAt"));
        return repository.findByTenantIdAndStatus(tenantId, QueueTaskStatus.DEAD_LETTER, pageable)
                .map(this::toDto);
    }

    /**
     * 统计租户下的死信任务数量（V1.6 新增）
     */
    @Transactional(readOnly = true)
    public long countDeadLetterTasks(UUID tenantId) {
        return repository.countByTenantIdAndStatus(tenantId, QueueTaskStatus.DEAD_LETTER);
    }

    /**
     * 扫描并重置到期重试任务（V1.6 新增，供 WorkerSchedulerService 调用）
     *
     * <p>查询 status=RETRY_SCHEDULED AND nextRetryAt &lt;= now 的任务，
     * 将其状态重置为 QUEUED 并清空 nextRetryAt，等待 Worker 重新领取。
     *
     * <p>批量操作避免逐条更新产生 N+1 性能问题。单次最多处理 100 条避免长事务。
     *
     * @return 本次重置的任务数量
     */
    @Transactional
    public int resetDueRetryScheduledTasks() {
        java.util.List<QueueTask> dueTasks = repository.findRetryScheduledDue(Instant.now());
        if (dueTasks.isEmpty()) {
            return 0;
        }

        int processed = 0;
        for (QueueTask task : dueTasks) {
            // 安全防护：单次最多处理 100 条，避免长事务
            if (processed >= 100) {
                break;
            }
            task.setStatus(QueueTaskStatus.QUEUED);
            task.setNextRetryAt(null);
            task.setQueuedAt(Instant.now());
            repository.save(task);
            processed++;
        }

        log.info("WorkerScheduler reset RETRY_SCHEDULED tasks: count={}", processed);
        return processed;
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
                entity.getDataRegion(),
                // V1.6 新增字段
                entity.getNextRetryAt(),
                entity.getRetryReason(),
                entity.getDeadLetteredAt(),
                entity.getDeadLetterReason()
        );
    }
}
