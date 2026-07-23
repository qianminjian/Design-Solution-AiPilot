package com.platform.core.portfolio.repository;

import com.platform.core.portfolio.domain.Project;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 项目仓储
 * 实体上的 @Where(deleted_at IS NULL) 自动过滤软删记录
 */
@Repository
public interface ProjectRepository extends JpaRepository<Project, UUID> {

    /**
     * 按租户分页查询（仅未软删）
     */
    Page<Project> findByTenantIdAndDeletedAtIsNull(UUID tenantId, Pageable pageable);

    /**
     * 按租户 + 状态分页查询
     */
    Page<Project> findByTenantIdAndStatusAndDeletedAtIsNull(UUID tenantId, String status, Pageable pageable);

    /**
     * 按 ID + 租户查询（防越权）
     */
    Optional<Project> findByIdAndTenantId(UUID id, UUID tenantId);

    /**
     * 检查租户内项目编码是否已存在（仅未软删）
     */
    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(UUID tenantId, String code);
}
