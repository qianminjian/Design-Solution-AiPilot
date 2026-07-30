package com.platform.core.change.taskplan.repository;

import com.platform.core.change.domain.enums.TaskPlanStatus;
import com.platform.core.change.taskplan.domain.TaskPlanItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 处置任务 Repository（D37.16 P12）
 *
 * <p>提供按租户、变更请求、状态、责任人等多维度查询入口。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Repository
public interface TaskPlanItemRepository
        extends JpaRepository<TaskPlanItem, UUID>, JpaSpecificationExecutor<TaskPlanItem> {

    List<TaskPlanItem> findAllByTenantIdAndChangeId(UUID tenantId, UUID changeId);

    Optional<TaskPlanItem> findByIdAndTenantId(UUID id, UUID tenantId);

    long countByTenantIdAndChangeId(UUID tenantId, UUID changeId);

    long countByTenantIdAndChangeIdAndStatus(
            UUID tenantId, UUID changeId, TaskPlanStatus status);

    /** 查询逾期且未完成的任务（用于监控） */
    List<TaskPlanItem> findAllByTenantIdAndChangeIdAndStatusNotAndDueDateBefore(
            UUID tenantId, UUID changeId, TaskPlanStatus status, java.time.Instant dueDate);
}
