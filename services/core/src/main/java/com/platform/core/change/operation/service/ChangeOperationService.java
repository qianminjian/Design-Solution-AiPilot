package com.platform.core.change.operation.service;

import com.platform.core.change.domain.enums.ChangeOperationPhase;
import com.platform.core.change.domain.enums.ChangeOperationPhaseStatus;
import com.platform.core.change.operation.domain.ChangeOperation;
import com.platform.core.change.operation.dto.ChangeOperationDto;
import com.platform.core.change.operation.repository.ChangeOperationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 变更操作阶段服务（D37.16 P12 变更影响与闭环工作台）
 *
 * <p>记录变更请求的状态流转历史，用于操作时间线展示。
 * 操作记录由 ChangeRequestService 在状态流转时自动调用 recordOperation 写入。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Service
public class ChangeOperationService {

    private static final Logger log = LoggerFactory.getLogger(ChangeOperationService.class);

    private final ChangeOperationRepository repository;

    public ChangeOperationService(ChangeOperationRepository repository) {
        this.repository = repository;
    }

    /**
     * 记录操作阶段（供 ChangeRequestService 调用）
     *
     * @param tenantId 租户 ID
     * @param changeId 变更请求 ID
     * @param phase 阶段
     * @param status 阶段状态
     * @param operatorId 操作人
     * @param comment 备注
     * @param fromStatus 操作前状态
     * @param toStatus 操作后状态
     */
    @Transactional
    public void recordOperation(
            UUID tenantId,
            UUID changeId,
            ChangeOperationPhase phase,
            ChangeOperationPhaseStatus status,
            String operatorId,
            String comment,
            String fromStatus,
            String toStatus
    ) {
        long existingCount = repository.countByTenantIdAndChangeId(tenantId, changeId);
        int sequence = (int) (existingCount + 1);

        ChangeOperation entity = new ChangeOperation();
        entity.setTenantId(tenantId);
        entity.setChangeId(changeId);
        entity.setPhase(phase);
        entity.setStatus(status);
        entity.setOperatorId(operatorId);
        entity.setOperatedAt(Instant.now());
        entity.setComment(comment);
        entity.setFromStatus(fromStatus);
        entity.setToStatus(toStatus);
        entity.setSequence(sequence);

        ChangeOperation saved = repository.save(entity);
        log.info("ChangeOperation recorded: id={}, changeId={}, tenantId={}, phase={}, status={}",
                saved.getId(), changeId, tenantId, phase, status);
    }

    /**
     * 查询变更请求的操作时间线
     */
    @Transactional(readOnly = true)
    public List<ChangeOperationDto> listOperations(UUID tenantId, UUID changeId) {
        return repository.findAllByTenantIdAndChangeIdOrderBySequenceAsc(tenantId, changeId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    // ── 实体 → DTO ──

    public ChangeOperationDto toDto(ChangeOperation entity) {
        return new ChangeOperationDto(
                entity.getId(),
                entity.getChangeId(),
                entity.getPhase(),
                entity.getStatus(),
                entity.getOperatorId(),
                entity.getOperatedAt(),
                entity.getComment(),
                entity.getFromStatus(),
                entity.getToStatus(),
                entity.getSequence(),
                entity.getCreatedAt()
        );
    }
}
