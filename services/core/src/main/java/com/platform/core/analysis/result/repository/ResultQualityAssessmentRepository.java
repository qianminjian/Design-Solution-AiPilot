package com.platform.core.analysis.result.repository;

import com.platform.core.analysis.domain.enums.QualityDecision;
import com.platform.core.analysis.result.domain.ResultQualityAssessment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 结果质量评估 Repository（D37.14 P10）
 *
 * <p>提供按租户、结果 ID、决策类型、评估人等多维度查询入口。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Repository
public interface ResultQualityAssessmentRepository
        extends JpaRepository<ResultQualityAssessment, UUID>, JpaSpecificationExecutor<ResultQualityAssessment> {

    /** 按结果 ID 查询全部评估记录（按评估时间倒序） */
    List<ResultQualityAssessment> findAllByTenantIdAndResultIdOrderByAssessedAtDesc(
            UUID tenantId, UUID resultId);

    /** 按结果 ID 查询最近一次评估 */
    Optional<ResultQualityAssessment> findFirstByTenantIdAndResultIdOrderByAssessedAtDesc(
            UUID tenantId, UUID resultId);

    /** 单条详情（含租户隔离） */
    Optional<ResultQualityAssessment> findByIdAndTenantId(UUID id, UUID tenantId);

    /** 按评估人和决策类型查询 */
    List<ResultQualityAssessment> findAllByTenantIdAndAssessorIdAndDecision(
            UUID tenantId, String assessorId, QualityDecision decision);

    /** 按结果 ID 统计评估次数 */
    long countByTenantIdAndResultId(UUID tenantId, UUID resultId);
}
