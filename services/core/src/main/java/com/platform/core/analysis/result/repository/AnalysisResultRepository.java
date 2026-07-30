package com.platform.core.analysis.result.repository;

import com.platform.core.analysis.domain.enums.ResultQualityStatus;
import com.platform.core.analysis.result.domain.AnalysisResult;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 分析结果 Repository（D37.14 P10）
 *
 * <p>提供按租户、运行 ID、问题 ID、质量状态、supersede 关系等多维度查询入口。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Repository
public interface AnalysisResultRepository
        extends JpaRepository<AnalysisResult, UUID>, JpaSpecificationExecutor<AnalysisResult> {

    /** 按租户分页查询 */
    Page<AnalysisResult> findByTenantId(UUID tenantId, Pageable pageable);

    /** 按租户和运行 ID 分页查询 */
    Page<AnalysisResult> findByTenantIdAndRunId(UUID tenantId, UUID runId, Pageable pageable);

    /** 按租户和问题 ID 分页查询 */
    Page<AnalysisResult> findByTenantIdAndProblemId(UUID tenantId, UUID problemId, Pageable pageable);

    /** 按租户和质量状态分页查询 */
    Page<AnalysisResult> findByTenantIdAndQualityStatus(
            UUID tenantId, ResultQualityStatus status, Pageable pageable);

    /** 按运行 ID 查询全部结果 */
    List<AnalysisResult> findAllByTenantIdAndRunId(UUID tenantId, UUID runId);

    /** 按问题 ID 查询全部结果 */
    List<AnalysisResult> findAllByTenantIdAndProblemId(UUID tenantId, UUID problemId);

    /** 单条详情（含租户隔离） */
    Optional<AnalysisResult> findByIdAndTenantId(UUID id, UUID tenantId);

    /** 按问题 ID 和质量状态统计 */
    long countByTenantIdAndProblemIdAndQualityStatus(
            UUID tenantId, UUID problemId, ResultQualityStatus status);

    /** 查询被某结果取代的旧结果列表 */
    List<AnalysisResult> findAllByTenantIdAndSupersededBy(UUID tenantId, UUID supersededBy);
}
