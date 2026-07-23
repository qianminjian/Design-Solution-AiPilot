package com.platform.core.iam.repository;

import com.platform.core.iam.domain.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 租户仓储
 */
@Repository
public interface TenantRepository extends JpaRepository<Tenant, UUID> {

    /**
     * 按租户编码查询（唯一）
     */
    Optional<Tenant> findByCode(String code);
}
