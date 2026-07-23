package com.platform.core.portfolio.repository;

import com.platform.core.portfolio.domain.GateDecision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 门禁决策仓储
 */
@Repository
public interface GateDecisionRepository extends JpaRepository<GateDecision, UUID> {

    /**
     * 按项目 ID 查询所有门禁（按创建时间倒序）
     */
    List<GateDecision> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    /**
     * 按 ID + 租户查询（防越权）
     */
    Optional<GateDecision> findByIdAndTenantId(UUID id, UUID tenantId);
}
