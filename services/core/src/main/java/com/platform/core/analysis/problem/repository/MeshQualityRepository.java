package com.platform.core.analysis.problem.repository;

import com.platform.core.analysis.problem.domain.MeshQuality;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 网格质量摘要 Repository（D37.14 P10）
 *
 * <p>提供按租户、问题 ID 查询网格质量入口。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Repository
public interface MeshQualityRepository
        extends JpaRepository<MeshQuality, UUID>, JpaSpecificationExecutor<MeshQuality> {

    /** 按问题 ID 查询最新网格质量摘要 */
    Optional<MeshQuality> findByTenantIdAndProblemId(UUID tenantId, UUID problemId);

    /** 单条详情（含租户隔离） */
    Optional<MeshQuality> findByIdAndTenantId(UUID id, UUID tenantId);
}
