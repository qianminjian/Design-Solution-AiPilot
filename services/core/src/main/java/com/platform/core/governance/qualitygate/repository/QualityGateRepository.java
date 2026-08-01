package com.platform.core.governance.qualitygate.repository;

import com.platform.core.governance.qualitygate.domain.QualityGate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * 质量门禁 Repository（D45.23，SIT P0-13.4）
 */
@Repository
public interface QualityGateRepository
        extends JpaRepository<QualityGate, UUID>,
        JpaSpecificationExecutor<QualityGate> {

    Page<QualityGate> findByTenantId(UUID tenantId, Pageable pageable);
}
