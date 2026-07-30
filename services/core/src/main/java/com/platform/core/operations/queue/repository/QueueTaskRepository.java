package com.platform.core.operations.queue.repository;

import com.platform.core.operations.domain.enums.QueueTaskPriority;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.domain.enums.QueueTaskType;
import com.platform.core.operations.queue.domain.QueueTask;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 队列任务 Repository
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
}
