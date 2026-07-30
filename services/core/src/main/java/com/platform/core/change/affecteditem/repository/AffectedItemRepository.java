package com.platform.core.change.affecteditem.repository;

import com.platform.core.change.affecteditem.domain.AffectedItem;
import com.platform.core.change.domain.enums.ImpactLevel;
import com.platform.core.change.domain.enums.RecheckStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 受影响项 Repository（D37.16 P12）
 *
 * <p>提供按租户、变更请求、影响等级、复查状态等多维度查询入口。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Repository
public interface AffectedItemRepository
        extends JpaRepository<AffectedItem, UUID>, JpaSpecificationExecutor<AffectedItem> {

    /** 按变更请求 ID 分页查询 */
    Page<AffectedItem> findByTenantIdAndChangeId(UUID tenantId, UUID changeId, Pageable pageable);

    /** 按变更请求 ID 查询全部（用于关闭校验） */
    List<AffectedItem> findAllByTenantIdAndChangeId(UUID tenantId, UUID changeId);

    /** 单条详情 */
    Optional<AffectedItem> findByIdAndTenantId(UUID id, UUID tenantId);

    /** 按变更请求 ID 统计受影响项数量 */
    long countByTenantIdAndChangeId(UUID tenantId, UUID changeId);

    /** 按变更请求 ID 和影响等级统计 */
    long countByTenantIdAndChangeIdAndImpact(UUID tenantId, UUID changeId, ImpactLevel impact);

    /** 按变更请求 ID 和复查状态统计 */
    long countByTenantIdAndChangeIdAndRecheckStatus(
            UUID tenantId, UUID changeId, RecheckStatus recheckStatus);
}
