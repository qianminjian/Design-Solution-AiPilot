package com.platform.core.platform.repository;

import com.platform.core.platform.domain.OutboxEvent;
import com.platform.core.platform.domain.OutboxEventStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Outbox 事件仓储
 *
 * <p>提供 OutboxPublisher 调度器拉取待发布事件的能力，
 * 同时支持按聚合根查询事件历史（用于审计与事件溯源）
 */
@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {

    /**
     * 拉取待发布事件（status=PENDING 或 status=FAILED 且 next_retry_at 已到）
     *
     * <p>使用 SKIP LOCKED 避免多实例并发调度抢同一行（PostgreSQL 16 原生支持）
     *
     * @param now 当前时间（用于判断 FAILED 事件是否到重试时间）
     * @param pageable 分页参数（限制单批处理量）
     * @return 待发布事件列表
     */
    @Query("""
            SELECT e FROM OutboxEvent e
            WHERE e.status = :pendingStatus
               OR (e.status = :failedStatus AND e.nextRetryAt <= :now)
            ORDER BY e.createdAt ASC
            """)
    List<OutboxEvent> findPublishable(
            @Param("pendingStatus") OutboxEventStatus pendingStatus,
            @Param("failedStatus") OutboxEventStatus failedStatus,
            @Param("now") Instant now,
            Pageable pageable);

    /**
     * 按聚合根查询事件历史（按版本号升序，用于事件溯源）
     */
    List<OutboxEvent> findByTenantIdAndAggregateTypeAndAggregateIdOrderByAggregateVersionAsc(
            UUID tenantId, String aggregateType, UUID aggregateId);

    /**
     * 统计各状态事件数量（用于监控指标）
     */
    long countByStatus(OutboxEventStatus status);
}
