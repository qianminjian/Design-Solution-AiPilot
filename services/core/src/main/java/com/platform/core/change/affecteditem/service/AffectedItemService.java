package com.platform.core.change.affecteditem.service;

import com.platform.core.change.affecteditem.domain.AffectedItem;
import com.platform.core.change.affecteditem.dto.AffectedItemDto;
import com.platform.core.change.affecteditem.dto.CreateAffectedItemRequest;
import com.platform.core.change.affecteditem.dto.ListAffectedItemsRequest;
import com.platform.core.change.affecteditem.dto.UpdateAffectedItemRequest;
import com.platform.core.change.affecteditem.repository.AffectedItemRepository;
import com.platform.core.change.domain.enums.ImpactLevel;
import com.platform.core.change.domain.enums.RecheckStatus;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 受影响项服务（D37.16 P12 变更影响与闭环工作台）
 *
 * 核心操作：
 *  - listAffectedItems：按变更请求 ID 查询受影响项
 *  - getAffectedItem：单条详情
 *  - createAffectedItem：手动添加受影响项
 *  - updateAffectedItem：更新影响判定/复查状态
 *  - deleteAffectedItem：删除受影响项
 *  - recheckAffectedItem：执行复查
 *
 * 安全红线：
 *  - UNKNOWN 影响项阻断关闭（在 ChangeRequestService.verifyClosure 中校验）
 *  - 需复查项必须进入复查流程，复查通过后才可关闭
 *  - 影响依据须可追溯
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Service
public class AffectedItemService {

    private static final Logger log = LoggerFactory.getLogger(AffectedItemService.class);

    private final AffectedItemRepository repository;

    public AffectedItemService(AffectedItemRepository repository) {
        this.repository = repository;
    }

    // ── 查询 ──

    @Transactional(readOnly = true)
    public Page<AffectedItemDto> listAffectedItems(
            UUID tenantId,
            UUID changeId,
            ListAffectedItemsRequest request
    ) {
        int page = request.page() != null && request.page() > 0 ? request.page() - 1 : 0;
        int size = request.pageSize() != null && request.pageSize() > 0 ? request.pageSize() : 50;
        Pageable pageable = PageRequest.of(
                page, size, Sort.by(Sort.Direction.ASC, "createdAt"));

        Specification<AffectedItem> spec = (root, query, cb) ->
                cb.and(
                        cb.equal(root.get("tenantId"), tenantId),
                        cb.equal(root.get("changeId"), changeId)
                );

        if (request.type() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("type"), request.type()));
        }
        if (request.impact() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("impact"), request.impact()));
        }
        if (request.recheckStatus() != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("recheckStatus"), request.recheckStatus()));
        }
        if (request.discipline() != null && !request.discipline().isBlank()) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("discipline"), request.discipline()));
        }
        if (request.keyword() != null && !request.keyword().isBlank()) {
            String pattern = "%" + request.keyword().toLowerCase() + "%";
            spec = spec.and((root, query, cb) ->
                    cb.or(
                            cb.like(cb.lower(root.get("code")), pattern),
                            cb.like(cb.lower(root.get("name")), pattern)
                    ));
        }

        return repository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public AffectedItemDto getAffectedItem(UUID tenantId, UUID id) {
        AffectedItem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AffectedItem not found: " + id));
        return toDto(entity);
    }

    /**
     * 查询变更请求下的全部受影响项（用于关闭校验）
     * 不分页，返回全部数据。
     */
    @Transactional(readOnly = true)
    public List<AffectedItemDto> getAllByChangeId(UUID tenantId, UUID changeId) {
        return repository.findAllByTenantIdAndChangeId(tenantId, changeId).stream()
                .map(this::toDto)
                .toList();
    }

    // ── 创建/更新/删除 ──

    @Transactional
    public AffectedItemDto createAffectedItem(
            UUID tenantId,
            UUID changeId,
            CreateAffectedItemRequest request
    ) {
        AffectedItem entity = new AffectedItem();
        entity.setTenantId(tenantId);
        entity.setChangeId(changeId);
        entity.setType(request.type());
        entity.setCode(request.code());
        entity.setName(request.name());
        entity.setDiscipline(request.discipline());
        entity.setAction(request.action());
        entity.setImpact(request.impact());
        entity.setRecheckRequired(request.recheckRequired());
        // 新建受影响项默认 NOT_REQUIRED 或 PENDING（取决于 recheckRequired）
        entity.setRecheckStatus(request.recheckRequired()
                ? RecheckStatus.PENDING
                : RecheckStatus.NOT_REQUIRED);
        entity.setOwner(request.owner());
        entity.setEvidence(request.evidence());
        entity.setSourceBaselineId(request.sourceBaselineId());
        entity.setWatermark(request.watermark());
        entity.setObjectRefId(request.objectRefId());

        AffectedItem saved = repository.save(entity);
        log.info("AffectedItem created: id={}, changeId={}, tenantId={}, type={}, code={}",
                saved.getId(), changeId, tenantId, saved.getType(), saved.getCode());
        return toDto(saved);
    }

    @Transactional
    public AffectedItemDto updateAffectedItem(
            UUID tenantId,
            UUID id,
            UpdateAffectedItemRequest request
    ) {
        AffectedItem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AffectedItem not found: " + id));

        if (request.impact() != null) {
            entity.setImpact(request.impact());
        }
        if (request.action() != null) {
            entity.setAction(request.action());
        }
        if (request.recheckRequired() != null) {
            entity.setRecheckRequired(request.recheckRequired());
            // 切换复查需求时重置状态
            if (request.recheckRequired() && entity.getRecheckStatus() == RecheckStatus.NOT_REQUIRED) {
                entity.setRecheckStatus(RecheckStatus.PENDING);
            } else if (!request.recheckRequired()
                    && entity.getRecheckStatus() == RecheckStatus.PENDING) {
                entity.setRecheckStatus(RecheckStatus.NOT_REQUIRED);
            }
        }
        if (request.recheckStatus() != null) {
            entity.setRecheckStatus(request.recheckStatus());
        }
        if (request.owner() != null && !request.owner().isBlank()) {
            entity.setOwner(request.owner());
        }
        if (request.evidence() != null) {
            entity.setEvidence(request.evidence());
        }

        AffectedItem saved = repository.save(entity);
        log.info("AffectedItem updated: id={}, tenantId={}, impact={}, recheckStatus={}",
                id, tenantId, saved.getImpact(), saved.getRecheckStatus());
        return toDto(saved);
    }

    @Transactional
    public void deleteAffectedItem(UUID tenantId, UUID id) {
        AffectedItem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AffectedItem not found: " + id));
        repository.delete(entity);
        log.info("AffectedItem deleted: id={}, tenantId={}", id, tenantId);
    }

    // ── 复查 ──

    /**
     * 执行复查（标记为 PASSED/FAILED）
     *
     * @param tenantId 租户 ID
     * @param id 受影响项 ID
     * @param recheckStatus 复查结果（PASSED / FAILED）
     * @param recheckedBy 复查人
     * @param comment 复查说明（追加到 evidence）
     */
    @Transactional
    public AffectedItemDto recheckAffectedItem(
            UUID tenantId,
            UUID id,
            RecheckStatus recheckStatus,
            String recheckedBy,
            String comment
    ) {
        AffectedItem entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AffectedItem not found: " + id));

        if (recheckStatus != RecheckStatus.PASSED
                && recheckStatus != RecheckStatus.FAILED
                && recheckStatus != RecheckStatus.WAIVED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.BAD_REQUEST,
                    "复查状态仅支持 PASSED / FAILED / WAIVED，当前: " + recheckStatus);
        }

        if (!entity.isRecheckRequired()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.CONFLICT,
                    "该受影响项不需要复查");
        }

        entity.setRecheckStatus(recheckStatus);
        entity.setRecheckedAt(Instant.now());
        entity.setRecheckedBy(recheckedBy);
        if (comment != null && !comment.isBlank()) {
            String existing = entity.getEvidence() == null ? "" : entity.getEvidence();
            entity.setEvidence(existing + (existing.isEmpty() ? "" : " | ") + "复查: " + comment);
        }

        AffectedItem saved = repository.save(entity);
        log.info("AffectedItem rechecked: id={}, tenantId={}, status={}, recheckedBy={}",
                id, tenantId, recheckStatus, recheckedBy);
        return toDto(saved);
    }

    // ── 统计（供 ChangeRequestService 关闭校验使用） ──

    @Transactional(readOnly = true)
    public long countUnknownImpact(UUID tenantId, UUID changeId) {
        return repository.countByTenantIdAndChangeIdAndImpact(
                tenantId, changeId, ImpactLevel.UNKNOWN);
    }

    @Transactional(readOnly = true)
    public long countPendingRecheck(UUID tenantId, UUID changeId) {
        return repository.countByTenantIdAndChangeIdAndRecheckStatus(
                tenantId, changeId, RecheckStatus.PENDING);
    }

    @Transactional(readOnly = true)
    public long countInProgressRecheck(UUID tenantId, UUID changeId) {
        return repository.countByTenantIdAndChangeIdAndRecheckStatus(
                tenantId, changeId, RecheckStatus.IN_PROGRESS);
    }

    @Transactional(readOnly = true)
    public long countByChangeId(UUID tenantId, UUID changeId) {
        return repository.countByTenantIdAndChangeId(tenantId, changeId);
    }

    // ── 实体 → DTO ──

    public AffectedItemDto toDto(AffectedItem entity) {
        return new AffectedItemDto(
                entity.getId(),
                entity.getChangeId(),
                entity.getType(),
                entity.getCode(),
                entity.getName(),
                entity.getDiscipline(),
                entity.getAction(),
                entity.getImpact(),
                entity.isRecheckRequired(),
                entity.getRecheckStatus(),
                entity.getOwner(),
                entity.getEvidence(),
                entity.getSourceBaselineId(),
                entity.getWatermark(),
                entity.getObjectRefId(),
                entity.getRecheckedAt(),
                entity.getRecheckedBy(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
