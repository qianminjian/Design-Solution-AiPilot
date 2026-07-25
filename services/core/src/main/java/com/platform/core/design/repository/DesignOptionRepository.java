package com.platform.core.design.repository;

import com.platform.core.design.domain.DesignOption;
import com.platform.core.design.domain.DesignOptionStatus;
import com.platform.core.design.domain.DesignDiscipline;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * 设计选项仓储
 */
public interface DesignOptionRepository extends JpaRepository<DesignOption, UUID> {

    /** 按租户+项目分页查询（无过滤参数） */
    Page<DesignOption> findByTenantIdAndProjectId(UUID tenantId, UUID projectId, Pageable pageable);

    /** 按租户+项目+状态分页查询 */
    Page<DesignOption> findByTenantIdAndProjectIdAndStatus(
            UUID tenantId, UUID projectId, DesignOptionStatus status, Pageable pageable);

    /** 按租户+项目+专业分页查询 */
    Page<DesignOption> findByTenantIdAndProjectIdAndDiscipline(
            UUID tenantId, UUID projectId, DesignDiscipline discipline, Pageable pageable);

    /** 按租户+项目+状态+专业分页查询 */
    Page<DesignOption> findByTenantIdAndProjectIdAndStatusAndDiscipline(
            UUID tenantId, UUID projectId, DesignOptionStatus status, DesignDiscipline discipline, Pageable pageable);

    /** 按租户+ID查询 */
    Optional<DesignOption> findByIdAndTenantId(UUID id, UUID tenantId);
}
