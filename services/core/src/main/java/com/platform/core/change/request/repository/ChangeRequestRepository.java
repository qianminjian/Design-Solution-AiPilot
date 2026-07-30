package com.platform.core.change.request.repository;

import com.platform.core.change.domain.enums.ChangeStatus;
import com.platform.core.change.domain.enums.ChangeType;
import com.platform.core.change.domain.enums.ChangePriority;
import com.platform.core.change.request.domain.ChangeRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 变更请求 Repository
 *
 * <p>提供按租户、状态、类型、优先级、关键字等多维度查询入口。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Repository
public interface ChangeRequestRepository
        extends JpaRepository<ChangeRequest, UUID>, JpaSpecificationExecutor<ChangeRequest> {

    Page<ChangeRequest> findByTenantId(UUID tenantId, Pageable pageable);

    Page<ChangeRequest> findByTenantIdAndStatus(
            UUID tenantId, ChangeStatus status, Pageable pageable);

    Page<ChangeRequest> findByTenantIdAndProjectId(
            UUID tenantId, String projectId, Pageable pageable);

    Optional<ChangeRequest> findByIdAndTenantId(UUID id, UUID tenantId);

    Optional<ChangeRequest> findByCodeAndTenantId(String code, UUID tenantId);

    long countByTenantIdAndStatus(UUID tenantId, ChangeStatus status);

    long countByTenantIdAndType(UUID tenantId, ChangeType type);

    long countByTenantIdAndPriority(UUID tenantId, ChangePriority priority);
}
