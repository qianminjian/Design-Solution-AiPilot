package com.platform.core.governance.evidence.repository;

import com.platform.core.governance.evidence.domain.EvidenceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * 治理域证据项 Repository
 */
@Repository
public interface EvidenceItemRepository extends JpaRepository<EvidenceItem, UUID> {

    List<EvidenceItem> findByPackageId(UUID packageId);

    void deleteByPackageId(UUID packageId);
}
