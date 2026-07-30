package com.platform.core.governance.accessgrant.repository;

import com.platform.core.governance.accessgrant.domain.AccessGrant;
import com.platform.core.governance.domain.enums.GovernanceAccessGrantStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 治理域访问授权 Repository
 *
 * <p>类名添加 Governance 前缀，避免与 iam.repository.AccessGrantRepository 命名冲突
 * （JPA Repository bean 名使用类名首字母小写，重名会导致
 * BeanDefinitionOverrideException）。
 *
 * <p>提供按租户、状态、风险等级等多维度查询入口。
 */
@Repository
public interface GovernanceAccessGrantRepository
        extends JpaRepository<AccessGrant, UUID>, JpaSpecificationExecutor<AccessGrant> {

    Page<AccessGrant> findByTenantId(UUID tenantId, Pageable pageable);

    Page<AccessGrant> findByTenantIdAndStatus(
            UUID tenantId, GovernanceAccessGrantStatus status, Pageable pageable);

    Optional<AccessGrant> findByIdAndTenantId(UUID id, UUID tenantId);

    long countByTenantIdAndStatus(UUID tenantId, GovernanceAccessGrantStatus status);
}
