package com.platform.core.governance.restore.repository;

import com.platform.core.governance.domain.enums.GovernanceRestoreDrillStatus;
import com.platform.core.governance.restore.domain.RestoreDrill;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 治理域灾备演练 Repository
 */
@Repository
public interface RestoreDrillRepository
        extends JpaRepository<RestoreDrill, UUID>, JpaSpecificationExecutor<RestoreDrill> {

    Page<RestoreDrill> findByTenantId(UUID tenantId, Pageable pageable);

    Page<RestoreDrill> findByTenantIdAndStatus(
            UUID tenantId, GovernanceRestoreDrillStatus status, Pageable pageable);

    Optional<RestoreDrill> findByIdAndTenantId(UUID id, UUID tenantId);
}
