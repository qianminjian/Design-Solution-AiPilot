package com.platform.core.operations.action.repository;

import com.platform.core.operations.action.domain.OperationsAction;
import com.platform.core.operations.domain.enums.DualApprovalStatus;
import com.platform.core.operations.domain.enums.OperationsActionStatus;
import com.platform.core.operations.domain.enums.OperationsActionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

/**
 * Operations 主动作 Repository
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@Repository
public interface OperationsActionRepository
        extends JpaRepository<OperationsAction, UUID>, JpaSpecificationExecutor<OperationsAction> {

    Page<OperationsAction> findByTenantId(UUID tenantId, Pageable pageable);

    Page<OperationsAction> findByTenantIdAndStatus(UUID tenantId, OperationsActionStatus status, Pageable pageable);

    Page<OperationsAction> findByTenantIdAndActionType(UUID tenantId, OperationsActionType actionType, Pageable pageable);

    Optional<OperationsAction> findByIdAndTenantId(UUID id, UUID tenantId);

    Optional<OperationsAction> findByTenantIdAndOperationId(UUID tenantId, String operationId);

    /**
     * 防止 retry storm：统计指定目标对象的近期 FAILED 动作数
     * （V0 占位：仅按目标 ID 统计，V1 接入时间窗口与指标计算）
     */
    long countByTenantIdAndTargetIdAndStatus(UUID tenantId, String targetId, OperationsActionStatus status);

    /**
     * 按双人审批状态查询操作列表（D37.23 §不可逆/合规：二人审批）
     * 用于审批人查看待审批 / 已审批的操作历史
     */
    Page<OperationsAction> findByTenantIdAndDualApprovalStatusIn(
            UUID tenantId, Collection<DualApprovalStatus> statuses, Pageable pageable);
}
