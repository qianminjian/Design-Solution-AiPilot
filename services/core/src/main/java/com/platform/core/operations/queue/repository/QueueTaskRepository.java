package com.platform.core.operations.queue.repository;

import com.platform.core.operations.domain.enums.QueueTaskPriority;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.domain.enums.QueueTaskType;
import com.platform.core.operations.queue.domain.QueueTask;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 队列任务 Repository
 *
 * V1.6 新增方法（Worker Scheduler 自动调度重试 + DeadLetterQueue）：
 *  - findRetryScheduledDue：扫描到期重试任务（status=RETRY_SCHEDULED AND nextRetryAt <= now）
 *  - countDeadLetterByTenant：统计租户下死信任务数量
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@Repository
public interface QueueTaskRepository
        extends JpaRepository<QueueTask, UUID>, JpaSpecificationExecutor<QueueTask> {

    Page<QueueTask> findByTenantId(UUID tenantId, Pageable pageable);

    Page<QueueTask> findByTenantIdAndStatus(UUID tenantId, QueueTaskStatus status, Pageable pageable);

    Page<QueueTask> findByTenantIdAndType(UUID tenantId, QueueTaskType type, Pageable pageable);

    Page<QueueTask> findByTenantIdAndPriority(UUID tenantId, QueueTaskPriority priority, Pageable pageable);

    Page<QueueTask> findByTenantIdAndWorkerId(UUID tenantId, UUID workerId, Pageable pageable);

    Optional<QueueTask> findByIdAndTenantId(UUID id, UUID tenantId);

    long countByTenantIdAndStatus(UUID tenantId, QueueTaskStatus status);

    long countByTenantIdAndStatusIn(UUID tenantId, java.util.Collection<QueueTaskStatus> statuses);

    /**
     * 扫描到期的重试调度任务（V1.6 新增）
     *
     * <p>查询所有 status=RETRY_SCHEDULED AND nextRetryAt &lt;= cutoff 的任务，
     * 供 WorkerSchedulerService.resetDueRetryScheduledTasks() 批量重置为 QUEUED。
     *
     * <p>使用 @Query 显式 JPQL 避免方法名过长，按 nextRetryAt 升序确保先到期的先处理。
     * 不分页以简化 V0 实现，service 层限制单次最多处理 100 条。
     *
     * @param cutoff 时间截断点（通常为 Instant.now()）
     * @return 到期任务列表
     */
    @Query("SELECT t FROM QueueTask t " +
            "WHERE t.status = com.platform.core.operations.domain.enums.QueueTaskStatus.RETRY_SCHEDULED " +
            "AND t.nextRetryAt IS NOT NULL AND t.nextRetryAt <= :cutoff " +
            "ORDER BY t.nextRetryAt ASC")
    List<QueueTask> findRetryScheduledDue(@Param("cutoff") Instant cutoff);

    /**
     * 统计租户下的死信任务数量（V1.6 新增）
     */
    default long countDeadLetterByTenant(UUID tenantId) {
        return countByTenantIdAndStatus(tenantId, QueueTaskStatus.DEAD_LETTER);
    }
}

