package com.platform.core.governance.evidence.repository;

import com.platform.core.governance.domain.enums.GovernanceEvidencePackageStatus;
import com.platform.core.governance.evidence.domain.EvidencePackage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 治理域证据包 Repository
 */
@Repository
public interface EvidencePackageRepository
        extends JpaRepository<EvidencePackage, UUID>, JpaSpecificationExecutor<EvidencePackage> {

    Page<EvidencePackage> findByTenantId(UUID tenantId, Pageable pageable);

    Page<EvidencePackage> findByTenantIdAndStatus(
            UUID tenantId, GovernanceEvidencePackageStatus status, Pageable pageable);

    Optional<EvidencePackage> findByIdAndTenantId(UUID id, UUID tenantId);
}
