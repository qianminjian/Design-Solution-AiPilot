package com.platform.core.change.operation.repository;

import com.platform.core.change.operation.domain.ChangeOperation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * 变更操作阶段 Repository（D37.16 P12）
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Repository
public interface ChangeOperationRepository
        extends JpaRepository<ChangeOperation, UUID>, JpaSpecificationExecutor<ChangeOperation> {

    List<ChangeOperation> findAllByTenantIdAndChangeIdOrderBySequenceAsc(
            UUID tenantId, UUID changeId);

    long countByTenantIdAndChangeId(UUID tenantId, UUID changeId);
}
