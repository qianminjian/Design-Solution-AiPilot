package com.platform.core.iam.repository;

import com.platform.core.iam.domain.RoleBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * 角色绑定仓储
 */
@Repository
public interface RoleBindingRepository extends JpaRepository<RoleBinding, UUID> {

    /**
     * 按主体 + 状态查询角色绑定
     * 用于 RBAC 鉴权时的角色装载
     */
    List<RoleBinding> findByTenantIdAndPrincipalIdAndStatus(UUID tenantId, UUID principalId, String status);

    /**
     * 按作用域查询角色绑定
     */
    List<RoleBinding> findByTenantIdAndScopeTypeAndScopeIdAndStatus(UUID tenantId, String scopeType, UUID scopeId, String status);
}
