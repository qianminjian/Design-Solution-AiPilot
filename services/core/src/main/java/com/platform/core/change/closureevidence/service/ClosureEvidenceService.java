package com.platform.core.change.closureevidence.service;

import com.platform.core.change.closureevidence.domain.ClosureEvidence;
import com.platform.core.change.closureevidence.dto.ClosureEvidenceDto;
import com.platform.core.change.closureevidence.dto.CreateClosureEvidenceRequest;
import com.platform.core.change.closureevidence.dto.VerifyClosureEvidenceRequest;
import com.platform.core.change.closureevidence.repository.ClosureEvidenceRepository;
import com.platform.core.change.domain.enums.ClosureEvidenceStatus;
import com.platform.core.change.domain.enums.ClosureEvidenceType;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 关闭证据服务（D37.16 P12 变更影响与闭环工作台）
 *
 * 核心操作：
 *  - listClosureEvidences：按变更请求 ID 查询证据
 *  - getClosureEvidence：单条详情
 *  - createClosureEvidence：手动添加证据
 *  - verifyClosureEvidence：验证证据（VERIFIED / REJECTED）
 *  - deleteClosureEvidence：删除证据
 *
 * 安全红线：
 *  - 关闭前所有 blocksClosure=true 的证据必须 VERIFIED
 *  - 高风险证据（AI_REVIEW/SIGNATURE）须双人复核
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@Service
public class ClosureEvidenceService {

    private static final Logger log = LoggerFactory.getLogger(ClosureEvidenceService.class);

    private final ClosureEvidenceRepository repository;

    public ClosureEvidenceService(ClosureEvidenceRepository repository) {
        this.repository = repository;
    }

    // ── 查询 ──

    @Transactional(readOnly = true)
    public List<ClosureEvidenceDto> listClosureEvidences(UUID tenantId, UUID changeId) {
        return repository.findAllByTenantIdAndChangeId(tenantId, changeId).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public ClosureEvidenceDto getClosureEvidence(UUID tenantId, UUID id) {
        ClosureEvidence entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "ClosureEvidence not found: " + id));
        return toDto(entity);
    }

    // ── 创建/删除 ──

    @Transactional
    public ClosureEvidenceDto createClosureEvidence(
            UUID tenantId,
            UUID changeId,
            CreateClosureEvidenceRequest request,
            String submittedBy
    ) {
        ClosureEvidence entity = new ClosureEvidence();
        entity.setTenantId(tenantId);
        entity.setChangeId(changeId);
        entity.setType(request.type());
        entity.setTitle(request.title());
        entity.setSourceId(request.sourceId());
        entity.setSourceDescription(request.sourceDescription());
        entity.setSummary(request.summary());
        entity.setEvidenceUrl(request.evidenceUrl());
        entity.setBlocksClosure(request.blocksClosure());
        entity.setSubmittedBy(submittedBy);
        entity.setSubmittedAt(Instant.now());
        entity.setStatus(ClosureEvidenceStatus.PENDING);

        // 高风险证据标记需要双人复核
        if (request.type() == ClosureEvidenceType.AI_REVIEW
                || request.type() == ClosureEvidenceType.SIGNATURE) {
            entity.setReviewer1(submittedBy);
        }

        ClosureEvidence saved = repository.save(entity);
        log.info("ClosureEvidence created: id={}, changeId={}, tenantId={}, type={}",
                saved.getId(), changeId, tenantId, saved.getType());
        return toDto(saved);
    }

    @Transactional
    public void deleteClosureEvidence(UUID tenantId, UUID id) {
        ClosureEvidence entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "ClosureEvidence not found: " + id));
        if (entity.getStatus() == ClosureEvidenceStatus.VERIFIED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "已验证的证据不可删除");
        }
        repository.delete(entity);
        log.info("ClosureEvidence deleted: id={}, tenantId={}", id, tenantId);
    }

    // ── 验证 ──

    /**
     * 验证证据
     *
     * @param tenantId 租户 ID
     * @param id 证据 ID
     * @param request 验证请求
     * @param verifiedBy 验证人
     */
    @Transactional
    public ClosureEvidenceDto verifyClosureEvidence(
            UUID tenantId,
            UUID id,
            VerifyClosureEvidenceRequest request,
            String verifiedBy
    ) {
        ClosureEvidence entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "ClosureEvidence not found: " + id));

        ClosureEvidenceStatus targetStatus;
        try {
            targetStatus = ClosureEvidenceStatus.valueOf(
                    request.verificationResult().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "verificationResult 仅支持 VERIFIED / REJECTED");
        }

        if (targetStatus != ClosureEvidenceStatus.VERIFIED
                && targetStatus != ClosureEvidenceStatus.REJECTED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "验证结果仅支持 VERIFIED / REJECTED，当前: " + targetStatus);
        }

        // 高风险证据双人复核
        if (entity.getType() == ClosureEvidenceType.AI_REVIEW
                || entity.getType() == ClosureEvidenceType.SIGNATURE) {
            if (request.reviewer2() == null || request.reviewer2().isBlank()) {
                throw new BusinessException(
                        ErrorCode.BUSINESS_RULE_VIOLATION,
                        "高风险证据（" + entity.getType() + "）必须双人复核，reviewer2 必填");
            }
            if (request.reviewer2().equals(verifiedBy)) {
                throw new BusinessException(
                        ErrorCode.BUSINESS_RULE_VIOLATION,
                        "复核人 2 不可与验证人相同（双人复核原则）");
            }
            entity.setReviewer2(request.reviewer2());
        }

        entity.setStatus(targetStatus);
        entity.setVerifiedBy(verifiedBy);
        entity.setVerifiedAt(Instant.now());
        entity.setVerificationNote(request.verificationNote());

        ClosureEvidence saved = repository.save(entity);
        log.info("ClosureEvidence verified: id={}, tenantId={}, result={}, verifiedBy={}",
                id, tenantId, targetStatus, verifiedBy);
        return toDto(saved);
    }

    // ── 统计（供 ChangeRequestService 关闭校验使用） ──

    @Transactional(readOnly = true)
    public long countBlockingEvidence(UUID tenantId, UUID changeId) {
        long total = repository.countByTenantIdAndChangeId(tenantId, changeId);
        long verified = repository.countByTenantIdAndChangeIdAndStatus(
                tenantId, changeId, ClosureEvidenceStatus.VERIFIED);
        long rejected = repository.countByTenantIdAndChangeIdAndStatus(
                tenantId, changeId, ClosureEvidenceStatus.REJECTED);
        long invalid = repository.countByTenantIdAndChangeIdAndStatus(
                tenantId, changeId, ClosureEvidenceStatus.INVALID);
        return total - verified - rejected - invalid;
    }

    @Transactional(readOnly = true)
    public long countRejected(UUID tenantId, UUID changeId) {
        return repository.countByTenantIdAndChangeIdAndStatus(
                tenantId, changeId, ClosureEvidenceStatus.REJECTED);
    }

    @Transactional(readOnly = true)
    public long countByChangeId(UUID tenantId, UUID changeId) {
        return repository.countByTenantIdAndChangeId(tenantId, changeId);
    }

    // ── 实体 → DTO ──

    public ClosureEvidenceDto toDto(ClosureEvidence entity) {
        return new ClosureEvidenceDto(
                entity.getId(),
                entity.getChangeId(),
                entity.getType(),
                entity.getTitle(),
                entity.getSourceId(),
                entity.getSourceDescription(),
                entity.getStatus(),
                entity.getVerifiedBy(),
                entity.getVerifiedAt(),
                entity.getVerificationNote(),
                entity.getSummary(),
                entity.getEvidenceUrl(),
                entity.isBlocksClosure(),
                entity.getSubmittedBy(),
                entity.getSubmittedAt(),
                entity.getReviewer1(),
                entity.getReviewer2(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
