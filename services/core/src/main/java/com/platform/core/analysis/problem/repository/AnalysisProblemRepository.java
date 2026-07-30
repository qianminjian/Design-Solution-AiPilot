package com.platform.core.analysis.problem.repository;

import com.platform.core.analysis.domain.enums.AnalysisProblemType;
import com.platform.core.analysis.domain.enums.ProblemStatus;
import com.platform.core.analysis.problem.domain.AnalysisProblem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 工程分析问题 Repository（D37.14 P10）
 *
 * <p>提供按租户、状态、类型、项目、关键字等多维度查询入口。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Repository
public interface AnalysisProblemRepository
        extends JpaRepository<AnalysisProblem, UUID>, JpaSpecificationExecutor<AnalysisProblem> {

    /** 按租户分页查询 */
    Page<AnalysisProblem> findByTenantId(UUID tenantId, Pageable pageable);

    /** 按租户和状态分页查询 */
    Page<AnalysisProblem> findByTenantIdAndStatus(
            UUID tenantId, ProblemStatus status, Pageable pageable);

    /** 按租户和项目分页查询 */
    Page<AnalysisProblem> findByTenantIdAndProjectId(
            UUID tenantId, String projectId, Pageable pageable);

    /** 按租户和类型分页查询 */
    Page<AnalysisProblem> findByTenantIdAndType(
            UUID tenantId, AnalysisProblemType type, Pageable pageable);

    /** 单条详情（含租户隔离） */
    Optional<AnalysisProblem> findByIdAndTenantId(UUID id, UUID tenantId);

    /** 按业务编号查询 */
    Optional<AnalysisProblem> findByCodeAndTenantId(String code, UUID tenantId);

    /** 统计租户下指定状态的工程分析问题数 */
    long countByTenantIdAndStatus(UUID tenantId, ProblemStatus status);

    /** 统计租户下指定类型的问题数 */
    long countByTenantIdAndType(UUID tenantId, AnalysisProblemType type);
}
