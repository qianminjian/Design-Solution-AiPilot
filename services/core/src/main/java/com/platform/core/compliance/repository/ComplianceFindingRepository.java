package com.platform.core.compliance.repository;

import com.platform.core.compliance.domain.ComplianceFinding;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

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
}