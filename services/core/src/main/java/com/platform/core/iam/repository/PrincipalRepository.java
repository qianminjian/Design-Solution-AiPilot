package com.platform.core.iam.repository;

import com.platform.core.iam.domain.Principal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 主体仓储
 */
@Repository
public interface PrincipalRepository extends JpaRepository<Principal, UUID> {

    /**
     * 按租户 + 邮箱查询（仅未软删）
     * 用于登录与唯一性校验
     */
    Optional<Principal> findByTenantIdAndEmailAndDeletedAtIsNull(UUID tenantId, String email);

    /**
     * 按租户 + 外部 ID 查询（仅未软删）
     */
    Optional<Principal> findByTenantIdAndExternalIdAndDeletedAtIsNull(UUID tenantId, String externalId);

    /**
     * 仅按邮箱查询首个未软删的主体（仅 V0 登录回退使用）
     * V0 阶段：前端登录前无法携带 x-tenant-id，登录时按邮箱反查租户
     * V1 阶段：接入正式认证流程后移除（多租户同名邮箱场景须由前端先解析租户）
     */
    Optional<Principal> findFirstByEmailAndDeletedAtIsNull(String email);

    /**
     * 按租户分页查询（仅未软删，@Where 自动过滤）
     */
    Page<Principal> findByTenantId(UUID tenantId, Pageable pageable);

    /**
     * 检查邮箱是否已存在
     */
    boolean existsByTenantIdAndEmailAndDeletedAtIsNull(UUID tenantId, String email);
}
