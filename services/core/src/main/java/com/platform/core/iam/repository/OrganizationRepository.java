package com.platform.core.iam.repository;

import com.platform.core.iam.domain.Organization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * 组织仓储
 */
@Repository
public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

    /**
     * 按租户 + 父组织查询子组织（分页）
     * 用于组织树层级浏览
     */
    Page<Organization> findByTenantIdAndParentId(UUID tenantId, UUID parentId, Pageable pageable);

    /**
     * 按租户查询顶层组织（parentId 为 null）
     */
    Page<Organization> findByTenantIdAndParentIdIsNull(UUID tenantId, Pageable pageable);
}
