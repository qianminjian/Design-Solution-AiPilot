package com.platform.core.workflow.repository;

import com.platform.core.workflow.domain.StageInstance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 工作流阶段实例仓储
 * 对应表 workflow.stage_instance（带软删除 @Where 过滤）
 */
@Repository
public interface StageInstanceRepository extends JpaRepository<StageInstance, UUID> {

    /**
     * 按项目 ID 查询所有阶段（按 stage_order 升序）
     * 软删除记录由 @Where 自动过滤
     */
    List<StageInstance> findByProjectIdOrderByStageOrder(UUID projectId);

    /**
     * 按项目 ID + 阶段状态查询
     */
    List<StageInstance> findByProjectIdAndStatus(UUID projectId, String status);

    /**
     * 按 ID + 租户查询（防越权）
     */
    Optional<StageInstance> findByIdAndTenantId(UUID id, UUID tenantId);

    /**
     * 按项目 ID + 阶段编码查询
     */
    Optional<StageInstance> findByProjectIdAndStageCode(UUID projectId, String stageCode);
}
