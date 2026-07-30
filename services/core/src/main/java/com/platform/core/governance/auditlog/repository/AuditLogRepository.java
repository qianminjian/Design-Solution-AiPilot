package com.platform.core.governance.auditlog.repository;

import com.platform.core.governance.auditlog.domain.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * 治理域审计日志 Repository
 *
 * 审计日志只追加，不更新；查询为主。
 */
@Repository
public interface AuditLogRepository
        extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog> {

    Optional<AuditLog> findByIdAndTenantId(UUID id, UUID tenantId);

    Page<AuditLog> findByTenantId(UUID tenantId, Pageable pageable);

    Page<AuditLog> findByTenantIdAndTraceId(
            UUID tenantId, String traceId, Pageable pageable);
}
