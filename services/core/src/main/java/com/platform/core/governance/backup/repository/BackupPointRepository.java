package com.platform.core.governance.backup.repository;

import com.platform.core.governance.backup.domain.BackupPoint;
import com.platform.core.governance.domain.enums.GovernanceBackupStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 治理域备份点 Repository
 */
@Repository
public interface BackupPointRepository
        extends JpaRepository<BackupPoint, UUID>, JpaSpecificationExecutor<BackupPoint> {

    Page<BackupPoint> findByTenantId(UUID tenantId, Pageable pageable);

    Page<BackupPoint> findByTenantIdAndStatus(
            UUID tenantId, GovernanceBackupStatus status, Pageable pageable);

    Optional<BackupPoint> findByIdAndTenantId(UUID id, UUID tenantId);
}
