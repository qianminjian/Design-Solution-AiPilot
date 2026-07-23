package com.platform.core.workflow.repository;

import com.platform.core.workflow.domain.ProjectBaseline;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 工作流项目基线仓储
 * 对应表 workflow.project_baseline（带软删除 @Where 过滤）
 */
@Repository
public interface ProjectBaselineRepository extends JpaRepository<ProjectBaseline, UUID> {

    /**
     * 按 ID + 租户查询（防越权）
     * 软删除记录由 @Where 自动过滤
     */
    Optional<ProjectBaseline> findByIdAndTenantId(UUID id, UUID tenantId);

    /**
     * 按项目 ID 查询所有基线（按修订号倒序）
     */
    List<ProjectBaseline> findByProjectIdOrderByRevisionNoDesc(UUID projectId);

    /**
     * 按项目 ID + 修订状态查询
     */
    List<ProjectBaseline> findByProjectIdAndStatus(UUID projectId, String status);

    /**
     * 查询项目下最大修订号（用于冻结新基线时计算 max + 1）
     * 返回 0 当项目尚无基线
     */
    @Query("SELECT COALESCE(MAX(b.revisionNo), 0) FROM ProjectBaseline b WHERE b.projectId = :projectId")
    Long findMaxRevisionNoByProjectId(@Param("projectId") UUID projectId);

    /**
     * 检查项目下是否存在指定状态的基线
     */
    boolean existsByProjectIdAndStatus(UUID projectId, com.platform.core.workflow.domain.RevisionStatus status);
}
