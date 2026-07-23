package com.platform.core.design.repository;

import com.platform.core.design.domain.DesignOption;
import com.platform.core.design.domain.DesignOptionStatus;
import com.platform.core.design.domain.DesignDiscipline;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

/**
 * 设计选项仓储
 */
public interface DesignOptionRepository extends JpaRepository<DesignOption, UUID> {

    /** 按租户+项目分页查询，支持状态和专业过滤 */
    @Query("SELECT d FROM DesignOption d WHERE d.tenantId = :tenantId AND d.projectId = :projectId " +
           "AND (:status IS NULL OR d.status = :status) " +
           "AND (:discipline IS NULL OR d.discipline = :discipline) " +
           "ORDER BY d.updatedAt DESC")
    Page<DesignOption> findByTenantIdAndProjectId(
            @Param("tenantId") UUID tenantId,
            @Param("projectId") UUID projectId,
            @Param("status") DesignOptionStatus status,
            @Param("discipline") DesignDiscipline discipline,
            Pageable pageable);

    /** 按租户+ID查询 */
    Optional<DesignOption> findByIdAndTenantId(UUID id, UUID tenantId);
}
