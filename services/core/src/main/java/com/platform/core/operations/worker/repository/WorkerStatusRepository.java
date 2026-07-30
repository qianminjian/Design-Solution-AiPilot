package com.platform.core.operations.worker.repository;

import com.platform.core.operations.domain.enums.WorkerRuntimeStatus;
import com.platform.core.operations.domain.enums.WorkerType;
import com.platform.core.operations.worker.domain.WorkerStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Worker 状态 Repository
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@Repository
public interface WorkerStatusRepository
        extends JpaRepository<WorkerStatus, UUID>, JpaSpecificationExecutor<WorkerStatus> {

    Page<WorkerStatus> findByTenantId(UUID tenantId, Pageable pageable);

    Page<WorkerStatus> findByTenantIdAndType(UUID tenantId, WorkerType type, Pageable pageable);

    Page<WorkerStatus> findByTenantIdAndStatus(UUID tenantId, WorkerRuntimeStatus status, Pageable pageable);

    Page<WorkerStatus> findByTenantIdAndRegion(UUID tenantId, String region, Pageable pageable);

    Optional<WorkerStatus> findByIdAndTenantId(UUID id, UUID tenantId);

    Optional<WorkerStatus> findByTenantIdAndWorkerCode(UUID tenantId, String workerCode);

    long countByTenantIdAndStatus(UUID tenantId, WorkerRuntimeStatus status);
}
