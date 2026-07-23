package com.platform.core.iam.repository;

import com.platform.core.iam.domain.AccessGrant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * 访问授权仓储
 */
@Repository
public interface AccessGrantRepository extends JpaRepository<AccessGrant, UUID> {

    /**
     * 按主体 + 状态查询细粒度授权
     */
    List<AccessGrant> findByTenantIdAndPrincipalIdAndStatus(UUID tenantId, UUID principalId, String status);

    /**
     * 按资源查询所有授权
     */
    List<AccessGrant> findByTenantIdAndResourceTypeAndResourceIdAndStatus(UUID tenantId, String resourceType, UUID resourceId, String status);
}
