package com.platform.core.tevv.repository;

import com.platform.core.tevv.domain.GoldenDataset;
import com.platform.core.tevv.domain.DatasetStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * 金样数据集仓库
 */
public interface GoldenDatasetRepository extends JpaRepository<GoldenDataset, UUID> {

    List<GoldenDataset> findByTenantIdAndStatus(UUID tenantId, DatasetStatus status);

    boolean existsByTenantIdAndNameAndVersion(UUID tenantId, String name, String version);
}
