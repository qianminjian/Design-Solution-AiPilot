package com.platform.core.compliance.repository;

import com.platform.core.compliance.domain.ComplianceFinding;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface ComplianceFindingRepository extends JpaRepository<ComplianceFinding, UUID>, JpaSpecificationExecutor<ComplianceFinding> {

    Page<ComplianceFinding> findByTenantId(UUID tenantId, Pageable pageable);

    Page<ComplianceFinding> findByTenantIdAndSeverity(UUID tenantId, String severity, Pageable pageable);

    Page<ComplianceFinding> findByTenantIdAndStatus(UUID tenantId, String status, Pageable pageable);

    Page<ComplianceFinding> findByTenantIdAndAssignedTo(UUID tenantId, UUID assignedTo, Pageable pageable);

    List<ComplianceFinding> findByResultId(UUID resultId);

    long countByTenantIdAndStatus(UUID tenantId, String status);

    /** 4 等级发布规则：CRITICAL 未关闭数量（D45.22） */
    long countByTenantIdAndSeverityAndStatusNot(UUID tenantId, String severity, String status);

    /** 4 等级发布规则：HIGH 处于指定状态集合数量（D45.22） */
    long countByTenantIdAndSeverityAndStatusIn(UUID tenantId, String severity, Collection<String> statuses);
}