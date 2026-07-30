package com.platform.core.operations.connector.repository;

import com.platform.core.operations.connector.domain.ConnectorStatus;
import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import com.platform.core.operations.domain.enums.ConnectorType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 连接器状态 Repository
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@Repository
public interface ConnectorStatusRepository
        extends JpaRepository<ConnectorStatus, UUID>, JpaSpecificationExecutor<ConnectorStatus> {

    Page<ConnectorStatus> findByTenantId(UUID tenantId, Pageable pageable);

    Page<ConnectorStatus> findByTenantIdAndType(UUID tenantId, ConnectorType type, Pageable pageable);

    Page<ConnectorStatus> findByTenantIdAndStatus(UUID tenantId, ConnectorHealthStatus status, Pageable pageable);

    Optional<ConnectorStatus> findByIdAndTenantId(UUID id, UUID tenantId);

    Optional<ConnectorStatus> findByTenantIdAndConnectorCode(UUID tenantId, String connectorCode);

    long countByTenantIdAndStatus(UUID tenantId, ConnectorHealthStatus status);
}
