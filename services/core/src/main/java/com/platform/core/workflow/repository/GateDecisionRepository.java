package com.platform.core.workflow.repository;

import com.platform.core.workflow.domain.GateDecision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 工作流门禁决策仓储
 * 对应表 workflow.gate_decision（带软删除 @Where 过滤）
 */
@Repository
public interface GateDecisionRepository extends JpaRepository<GateDecision, UUID> {

    /**
     * 按项目 ID 查询所有门禁（按创建时间倒序）
     * 软删除记录由 @Where 自动过滤
     */
    List<GateDecision> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    /**
     * 按阶段 ID 查询所有门禁（按创建时间倒序）
     */
    List<GateDecision> findByStageIdOrderByCreatedAtDesc(UUID stageId);

    /**
     * 按阶段 ID + 门禁状态查询
     */
    List<GateDecision> findByStageIdAndStatus(UUID stageId, String status);

    /**
     * 按 ID + 租户查询（防越权）
     */
    Optional<GateDecision> findByIdAndTenantId(UUID id, UUID tenantId);
}
