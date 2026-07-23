package com.platform.core.portfolio.repository;

import com.platform.core.portfolio.domain.ProjectBaseline;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 项目基线仓储
 */
@Repository
public interface ProjectBaselineRepository extends JpaRepository<ProjectBaseline, UUID> {

    /**
     * 按 ID + 租户查询（防越权）
     */
    Optional<ProjectBaseline> findByIdAndTenantId(UUID id, UUID tenantId);

    /**
     * 按项目 ID 查询所有基线（按修订号倒序）
     */
    List<ProjectBaseline> findByProjectIdOrderByRevisionNoDesc(UUID projectId);

    /**
     * 检查项目下是否存在指定状态的基线
     */
    boolean existsByProjectIdAndStatus(UUID projectId, String status);

    /**
     * 查询项目下最大修订号（用于冻结新基线时计算 max + 1）
     * 返回 0 当项目尚无基线
     */
    @Query("SELECT COALESCE(MAX(b.revisionNo), 0) FROM ProjectBaseline b WHERE b.projectId = :projectId")
    Long findMaxRevisionNoByProjectId(@Param("projectId") UUID projectId);
}
