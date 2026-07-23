package com.platform.core.compliance.repository;

import com.platform.core.compliance.domain.ComplianceRule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ComplianceRuleRepository extends JpaRepository<ComplianceRule, UUID>, JpaSpecificationExecutor<ComplianceRule> {

    Page<ComplianceRule> findByTenantId(UUID tenantId, Pageable pageable);

    Page<ComplianceRule> findByTenantIdAndCategory(UUID tenantId, String category, Pageable pageable);

    Page<ComplianceRule> findByTenantIdAndStatus(UUID tenantId, String status, Pageable pageable);

    Optional<ComplianceRule> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndRuleCode(UUID tenantId, String ruleCode);
}