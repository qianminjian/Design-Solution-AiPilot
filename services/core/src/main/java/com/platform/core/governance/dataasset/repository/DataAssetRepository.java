package com.platform.core.governance.dataasset.repository;

import com.platform.core.governance.dataasset.domain.DataAsset;
import com.platform.core.governance.domain.enums.GovernanceDataAssetStatus;
import com.platform.core.governance.domain.enums.GovernanceDataAssetType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 治理域数据资产 Repository
 */
@Repository
public interface DataAssetRepository
        extends JpaRepository<DataAsset, UUID>, JpaSpecificationExecutor<DataAsset> {

    Page<DataAsset> findByTenantId(UUID tenantId, Pageable pageable);

    Page<DataAsset> findByTenantIdAndStatus(
            UUID tenantId, GovernanceDataAssetStatus status, Pageable pageable);

    Page<DataAsset> findByTenantIdAndType(
            UUID tenantId, GovernanceDataAssetType type, Pageable pageable);

    Optional<DataAsset> findByIdAndTenantId(UUID id, UUID tenantId);
}
