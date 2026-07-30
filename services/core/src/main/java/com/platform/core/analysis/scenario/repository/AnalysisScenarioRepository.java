package com.platform.core.analysis.scenario.repository;

import com.platform.core.analysis.scenario.domain.AnalysisScenario;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 分析场景 Repository（D37.14 P10）
 *
 * <p>提供按租户、问题 ID、场景类型、是否 AI 推荐等多维度查询入口。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Repository
public interface AnalysisScenarioRepository
        extends JpaRepository<AnalysisScenario, UUID>, JpaSpecificationExecutor<AnalysisScenario> {

    /** 按租户和问题 ID 分页查询 */
    Page<AnalysisScenario> findByTenantIdAndProblemId(UUID tenantId, UUID problemId, Pageable pageable);

    /** 按租户和问题 ID 查询全部（用于运行前校验） */
    List<AnalysisScenario> findAllByTenantIdAndProblemId(UUID tenantId, UUID problemId);

    /** 按租户和问题 ID 查询基线场景 */
    Optional<AnalysisScenario> findByTenantIdAndProblemIdAndBaselineTrue(UUID tenantId, UUID problemId);

    /** 单条详情（含租户隔离） */
    Optional<AnalysisScenario> findByIdAndTenantId(UUID id, UUID tenantId);

    /** 按 AI 推荐统计 */
    long countByTenantIdAndProblemIdAndAiRecommendedTrue(UUID tenantId, UUID problemId);

    /** 按问题 ID 统计场景数 */
    long countByTenantIdAndProblemId(UUID tenantId, UUID problemId);
}
