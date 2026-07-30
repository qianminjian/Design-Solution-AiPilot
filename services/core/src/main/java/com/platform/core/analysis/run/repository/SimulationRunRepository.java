package com.platform.core.analysis.run.repository;

import com.platform.core.analysis.domain.enums.RunStatus;
import com.platform.core.analysis.run.domain.SimulationRun;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 模拟运行 Repository（D37.14 P10）
 *
 * <p>提供按租户、问题 ID、场景 ID、状态、unknown job 等多维度查询入口。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Repository
public interface SimulationRunRepository
        extends JpaRepository<SimulationRun, UUID>, JpaSpecificationExecutor<SimulationRun> {

    /** 按租户分页查询 */
    Page<SimulationRun> findByTenantId(UUID tenantId, Pageable pageable);

    /** 按租户和问题 ID 分页查询 */
    Page<SimulationRun> findByTenantIdAndProblemId(UUID tenantId, UUID problemId, Pageable pageable);

    /** 按租户和场景 ID 分页查询 */
    Page<SimulationRun> findByTenantIdAndScenarioId(UUID tenantId, UUID scenarioId, Pageable pageable);

    /** 按租户和状态分页查询 */
    Page<SimulationRun> findByTenantIdAndStatus(UUID tenantId, RunStatus status, Pageable pageable);

    /** 单条详情（含租户隔离） */
    Optional<SimulationRun> findByIdAndTenantId(UUID id, UUID tenantId);

    /** 查询 unknown job 列表（需 Reconcile） */
    List<SimulationRun> findAllByTenantIdAndUnknownJobTrue(UUID tenantId);

    /** 按问题 ID 查询运行列表（用于问题详情聚合） */
    List<SimulationRun> findAllByTenantIdAndProblemId(UUID tenantId, UUID problemId);

    /** 按问题 ID 统计运行数 */
    long countByTenantIdAndProblemId(UUID tenantId, UUID problemId);

    /** 按问题 ID 和状态统计（用于问题最新状态同步） */
    long countByTenantIdAndProblemIdAndStatus(UUID tenantId, UUID problemId, RunStatus status);

    /** 按上游运行 ID 查询重试链 */
    List<SimulationRun> findAllByTenantIdAndParentRunId(UUID tenantId, UUID parentRunId);

    /** 按 SolverProfile 统计正在运行的任务（容量校验） */
    long countByTenantIdAndSolverProfileIdAndStatusIn(
            UUID tenantId, UUID solverProfileId, List<RunStatus> statuses);
}
