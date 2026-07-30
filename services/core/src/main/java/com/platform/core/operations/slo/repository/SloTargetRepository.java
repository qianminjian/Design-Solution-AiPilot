package com.platform.core.operations.slo.repository;

import com.platform.core.operations.domain.enums.SloStatus;
import com.platform.core.operations.slo.domain.SloTarget;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * SLO 目标 Repository
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@Repository
public interface SloTargetRepository
        extends JpaRepository<SloTarget, UUID>, JpaSpecificationExecutor<SloTarget> {

    Page<SloTarget> findByTenantId(UUID tenantId, Pageable pageable);

    Page<SloTarget> findByTenantIdAndStatus(UUID tenantId, SloStatus status, Pageable pageable);

    Optional<SloTarget> findByIdAndTenantId(UUID id, UUID tenantId);

    long countByTenantIdAndStatus(UUID tenantId, SloStatus status);
}
