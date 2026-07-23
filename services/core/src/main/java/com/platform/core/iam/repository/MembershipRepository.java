package com.platform.core.iam.repository;

import com.platform.core.iam.domain.Membership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * 成员关系仓储
 */
@Repository
public interface MembershipRepository extends JpaRepository<Membership, UUID> {

    /**
     * 按主体查询所有有效成员关系
     */
    List<Membership> findByTenantIdAndPrincipalIdAndStatus(UUID tenantId, UUID principalId, String status);

    /**
     * 按组织查询所有成员
     */
    List<Membership> findByTenantIdAndOrganizationIdAndStatus(UUID tenantId, UUID organizationId, String status);
}
