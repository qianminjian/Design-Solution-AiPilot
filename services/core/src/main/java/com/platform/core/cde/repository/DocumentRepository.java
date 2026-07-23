package com.platform.core.cde.repository;

import com.platform.core.cde.domain.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 文档仓储
 * 实体上的 @Where(deleted_at IS NULL) 自动过滤软删记录
 */
@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {

    /**
     * 按 ID + 租户查询（防越权）
     */
    Optional<Document> findByIdAndTenantId(UUID id, UUID tenantId);

    /**
     * 按租户 + 项目分页查询（仅未软删）
     */
    Page<Document> findByTenantIdAndProjectIdAndDeletedAtIsNull(UUID tenantId, UUID projectId, Pageable pageable);

    /**
     * 按租户 + 项目 + 状态分页查询
     */
    Page<Document> findByTenantIdAndProjectIdAndStatusAndDeletedAtIsNull(UUID tenantId, UUID projectId, String status, Pageable pageable);

    /**
     * 按租户 + 项目 + 名称模糊查询
     */
    Page<Document> findByTenantIdAndProjectIdAndNameContainingIgnoreCaseAndDeletedAtIsNull(
            UUID tenantId, UUID projectId, String keyword, Pageable pageable);
}
