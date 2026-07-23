package com.platform.core.tevv.repository;

import com.platform.core.tevv.domain.VerificationItem;
import com.platform.core.tevv.domain.VerificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * 验证项仓库
 */
public interface VerificationItemRepository extends JpaRepository<VerificationItem, UUID> {

    List<VerificationItem> findByTenantIdAndDatasetId(UUID tenantId, UUID datasetId);

    List<VerificationItem> findByTenantIdAndDatasetIdAndGateNumber(UUID tenantId, UUID datasetId, Short gateNumber);

    long countByTenantIdAndDatasetIdAndStatus(UUID tenantId, UUID datasetId, VerificationStatus status);
}
