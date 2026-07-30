package com.platform.core.change.closureevidence.repository;

import com.platform.core.change.closureevidence.domain.ClosureEvidence;
import com.platform.core.change.domain.enums.ClosureEvidenceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 关闭证据 Repository（D37.16 P12）
 *
 * <p>提供按租户、变更请求、状态等多维度查询入口。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Repository
public interface ClosureEvidenceRepository
        extends JpaRepository<ClosureEvidence, UUID>, JpaSpecificationExecutor<ClosureEvidence> {

    List<ClosureEvidence> findAllByTenantIdAndChangeId(UUID tenantId, UUID changeId);

    Optional<ClosureEvidence> findByIdAndTenantId(UUID id, UUID tenantId);

    long countByTenantIdAndChangeId(UUID tenantId, UUID changeId);

    long countByTenantIdAndChangeIdAndStatus(
            UUID tenantId, UUID changeId, ClosureEvidenceStatus status);
}
