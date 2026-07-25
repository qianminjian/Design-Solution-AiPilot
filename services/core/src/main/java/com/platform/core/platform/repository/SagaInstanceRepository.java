package com.platform.core.platform.repository;

import com.platform.core.platform.domain.SagaInstance;
import com.platform.core.platform.domain.SagaStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Saga 实例仓储
 *
 * <p>提供 Saga 协调器（{@link com.platform.core.platform.service.SagaCoordinator}）
 * 查询、持久化 Saga 状态的能力
 */
@Repository
public interface SagaInstanceRepository extends JpaRepository<SagaInstance, UUID> {

    /**
     * 按聚合根查询 Saga 历史（用于审计与重放）
     */
    List<SagaInstance> findByTenantIdAndAggregateTypeAndAggregateIdOrderByStartedAtDesc(
            UUID tenantId, String aggregateType, UUID aggregateId);

    /**
     * 统计各状态 Saga 数量（用于监控指标）
     */
    long countByStatus(SagaStatus status);

    /**
     * 查询处于指定状态的 Saga（用于补偿调度器扫描）
     */
    List<SagaInstance> findByStatus(SagaStatus status);
}
