package com.platform.core.compliance.repository;

import com.platform.core.compliance.domain.ComplianceCheckRun;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ComplianceCheckRunRepository extends JpaRepository<ComplianceCheckRun, UUID>, JpaSpecificationExecutor<ComplianceCheckRun> {

    Page<ComplianceCheckRun> findByTenantId(UUID tenantId, Pageable pageable);

    Page<ComplianceCheckRun> findByProjectId(UUID projectId, Pageable pageable);

    List<ComplianceCheckRun> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    Optional<ComplianceCheckRun> findByIdAndTenantId(UUID id, UUID tenantId);
}