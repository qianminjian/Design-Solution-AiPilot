package com.platform.core.portfolio.repository;

import com.platform.core.portfolio.domain.StageInstance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 阶段实例仓储
 */
@Repository
public interface StageInstanceRepository extends JpaRepository<StageInstance, UUID> {

    /**
     * 按项目 ID 查询所有阶段（按 stage_order 升序）
     */
    List<StageInstance> findByProjectIdOrderByStageOrder(UUID projectId);

    /**
     * 按 ID + 租户查询（防越权）
     */
    Optional<StageInstance> findByIdAndTenantId(UUID id, UUID tenantId);

    /**
     * 按项目 ID + 阶段编码查询
     */
    Optional<StageInstance> findByProjectIdAndStageCode(UUID projectId, String stageCode);
}
