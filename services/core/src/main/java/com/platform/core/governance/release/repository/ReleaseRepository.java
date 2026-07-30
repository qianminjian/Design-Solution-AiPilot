package com.platform.core.governance.release.repository;

import com.platform.core.governance.domain.enums.GovernanceReleaseStatus;
import com.platform.core.governance.domain.enums.GovernanceReleaseType;
import com.platform.core.governance.release.domain.Release;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 治理域 Release Repository
 */
@Repository
public interface ReleaseRepository
        extends JpaRepository<Release, UUID>, JpaSpecificationExecutor<Release> {

    Page<Release> findByTenantId(UUID tenantId, Pageable pageable);

    Page<Release> findByTenantIdAndStatus(
            UUID tenantId, GovernanceReleaseStatus status, Pageable pageable);

    Page<Release> findByTenantIdAndType(
            UUID tenantId, GovernanceReleaseType type, Pageable pageable);

    Optional<Release> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndNameAndVersion(
            UUID tenantId, String name, String version);
}
