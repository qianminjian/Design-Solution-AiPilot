package com.platform.core.analysis.solver.repository;

import com.platform.core.analysis.solver.domain.SolverProfile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 求解器配置 Repository（D37.14 P10）
 *
 * <p>提供按租户、激活状态、求解器类型等多维度查询入口。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Repository
public interface SolverProfileRepository
        extends JpaRepository<SolverProfile, UUID>, JpaSpecificationExecutor<SolverProfile> {

    /** 按租户分页查询 */
    Page<SolverProfile> findByTenantId(UUID tenantId, Pageable pageable);

    /** 按租户和激活状态分页查询 */
    Page<SolverProfile> findByTenantIdAndActive(
            UUID tenantId, boolean active, Pageable pageable);

    /** 按租户和求解器类型分页查询 */
    Page<SolverProfile> findByTenantIdAndSolverType(
            UUID tenantId, String solverType, Pageable pageable);

    /** 单条详情（含租户隔离） */
    Optional<SolverProfile> findByIdAndTenantId(UUID id, UUID tenantId);

    /** 按业务编号查询 */
    Optional<SolverProfile> findByCodeAndTenantId(String code, UUID tenantId);
}
