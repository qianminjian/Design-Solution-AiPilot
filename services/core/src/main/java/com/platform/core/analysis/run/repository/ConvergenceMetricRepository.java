package com.platform.core.analysis.run.repository;

import com.platform.core.analysis.run.domain.ConvergenceMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 收敛指标 Repository（D37.14 P10）
 *
 * <p>提供按租户、运行 ID 查询收敛曲线的入口。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Repository
public interface ConvergenceMetricRepository
        extends JpaRepository<ConvergenceMetric, UUID>, JpaSpecificationExecutor<ConvergenceMetric> {

    /** 按运行 ID 查询全部收敛指标（按迭代次数正序） */
    List<ConvergenceMetric> findAllByTenantIdAndRunIdOrderByIterationAsc(UUID tenantId, UUID runId);

    /** 按运行 ID 查询最近一次迭代 */
    Optional<ConvergenceMetric> findFirstByTenantIdAndRunIdOrderByIterationDesc(UUID tenantId, UUID runId);

    /** 单条详情（含租户隔离） */
    Optional<ConvergenceMetric> findByIdAndTenantId(UUID id, UUID tenantId);

    /** 按运行 ID 统计迭代次数 */
    long countByTenantIdAndRunId(UUID tenantId, UUID runId);
}
