package com.platform.core.analysis.run.repository;

import com.platform.core.analysis.run.domain.RunTimelineEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 运行时间线事件 Repository（D37.14 P10）
 *
 * <p>提供按租户、运行 ID、事件类型等多维度查询入口。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Repository
public interface RunTimelineEventRepository
        extends JpaRepository<RunTimelineEvent, UUID>, JpaSpecificationExecutor<RunTimelineEvent> {

    /** 按运行 ID 查询全部时间线（按发生时间正序） */
    List<RunTimelineEvent> findAllByTenantIdAndRunIdOrderByOccurredAtAsc(UUID tenantId, UUID runId);

    /** 单条详情（含租户隔离） */
    Optional<RunTimelineEvent> findByIdAndTenantId(UUID id, UUID tenantId);

    /** 按运行 ID 和事件类型查询 */
    List<RunTimelineEvent> findAllByTenantIdAndRunIdAndEventType(
            UUID tenantId, UUID runId, String eventType);

    /** 按运行 ID 统计事件数 */
    long countByTenantIdAndRunId(UUID tenantId, UUID runId);
}
