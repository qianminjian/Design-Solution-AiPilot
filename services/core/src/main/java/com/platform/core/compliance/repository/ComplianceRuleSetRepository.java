package com.platform.core.compliance.repository;

import com.platform.core.compliance.domain.ComplianceRuleSet;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ComplianceRuleSetRepository extends JpaRepository<ComplianceRuleSet, UUID>, JpaSpecificationExecutor<ComplianceRuleSet> {

    Page<ComplianceRuleSet> findByTenantId(UUID tenantId, Pageable pageable);

    Page<ComplianceRuleSet> findByTenantIdAndStageCode(UUID tenantId, String stageCode, Pageable pageable);

    Page<ComplianceRuleSet> findByTenantIdAndStatus(UUID tenantId, String status, Pageable pageable);

    Optional<ComplianceRuleSet> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndName(UUID tenantId, String name);
}