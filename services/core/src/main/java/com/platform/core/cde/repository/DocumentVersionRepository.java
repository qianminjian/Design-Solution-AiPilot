package com.platform.core.cde.repository;

import com.platform.core.cde.domain.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 文档版本仓储
 * 版本表无软删除字段，所有版本永久保留（不可变修订模型）
 */
@Repository
public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, UUID> {

    /**
     * 按 ID + 租户查询（防越权）
     */
    Optional<DocumentVersion> findByIdAndTenantId(UUID id, UUID tenantId);

    /**
     * 按文档 ID 查询所有版本（按 version_number 降序）
     */
    List<DocumentVersion> findByDocumentIdOrderByVersionNumberDesc(UUID documentId);

    /**
     * 按文档 ID + 租户查询所有版本（按 version_number 降序）
     */
    List<DocumentVersion> findByDocumentIdAndTenantIdOrderByVersionNumberDesc(UUID documentId, UUID tenantId);

    /**
     * 查询文档当前最大版本号（用于自动递增）
     * 返回 null 表示尚无版本
     */
    @Query("SELECT MAX(v.versionNumber) FROM DocumentVersion v WHERE v.documentId = :documentId")
    Integer findMaxVersionNumber(@Param("documentId") UUID documentId);

    /**
     * 将文档下所有非 SUPERSEDED 的旧版本状态置为 SUPERSEDED
     * 用于新版本上传后旧版本自动归档
     */
    @Modifying
    @Query("UPDATE DocumentVersion v SET v.status = 'SUPERSEDED' " +
            "WHERE v.documentId = :documentId AND v.status <> 'SUPERSEDED' AND v.id <> :excludeVersionId")
    int markPreviousVersionsSuperseded(@Param("documentId") UUID documentId,
                                       @Param("excludeVersionId") UUID excludeVersionId);
}
