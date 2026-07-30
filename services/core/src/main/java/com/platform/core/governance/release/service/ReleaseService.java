package com.platform.core.governance.release.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.domain.enums.GovernanceMetricsDrift;
import com.platform.core.governance.domain.enums.GovernanceRedteamStatus;
import com.platform.core.governance.domain.enums.GovernanceReleaseStatus;
import com.platform.core.governance.release.domain.Release;
import com.platform.core.governance.release.domain.ReleaseDiffSummary;
import com.platform.core.governance.release.dto.ReleaseActionRequest;
import com.platform.core.governance.release.dto.ReleaseDto;
import com.platform.core.governance.release.repository.ReleaseRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 治理域 Release 服务（D37.17 AI/Rule Release）
 *
 * 状态机：
 *  DRAFT → REVIEW (提交评审)
 *  REVIEW → CANARY (审批通过)
 *  REVIEW → DEPRECATED (拒绝)
 *  CANARY → PROMOTED (灰度转全量)
 *  CANARY → ROLLED_BACK (灰度失败回滚)
 *  PROMOTED → ROLLED_BACK (生产问题回滚)
 *  PROMOTED → DEPRECATED (生命周期结束)
 *
 * 安全：
 *  - hasEvalGap=true 禁止 PROMOTE
 *  - redteamStatus=FAIL 禁止 CANARY / PROMOTE
 *  - metricsDrift=MAJOR 必须先回滚或降级才能继续 PROMOTE
 *  - ROLLBACK / DEPRECATE 必须提供 stepUpToken
 */
@Service
public class ReleaseService {

    private static final Logger log = LoggerFactory.getLogger(ReleaseService.class);

    private final ReleaseRepository repository;

    public ReleaseService(ReleaseRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Page<ReleaseDto> listReleases(
            UUID tenantId,
            GovernanceReleaseStatus status,
            Pageable pageable
    ) {
        Specification<Release> spec = (root, query, cb) ->
                cb.equal(root.get("tenantId"), tenantId);
        if (status != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("status"), status));
        }
        return repository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public ReleaseDto getRelease(UUID tenantId, UUID id) {
        Release entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "Release not found: " + id));
        return toDto(entity);
    }

    @Transactional
    public ReleaseDto actOnRelease(
            UUID tenantId,
            UUID id,
            ReleaseActionRequest request,
            HttpServletRequest httpRequest
    ) {
        Release entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "Release not found: " + id));

        String operator = resolveOperator(httpRequest);
        validateStepUp(request);

        switch (request.action()) {
            case APPROVE -> {
                if (entity.getStatus() != GovernanceReleaseStatus.REVIEW) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Only REVIEW status can be approved");
                }
                if (entity.getRedteamStatus() == GovernanceRedteamStatus.FAIL) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Redteam status is FAIL, cannot approve");
                }
                entity.setStatus(GovernanceReleaseStatus.CANARY);
                if (entity.getCanaryPercent() == 0) {
                    entity.setCanaryPercent(5);
                }
            }
            case CANARY -> {
                if (request.canaryPercent() == null) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "canaryPercent is required for CANARY action");
                }
                if (entity.getStatus() != GovernanceReleaseStatus.CANARY
                        && entity.getStatus() != GovernanceReleaseStatus.REVIEW) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Only REVIEW or CANARY status can adjust canary");
                }
                entity.setCanaryPercent(request.canaryPercent());
                if (entity.getStatus() != GovernanceReleaseStatus.CANARY) {
                    entity.setStatus(GovernanceReleaseStatus.CANARY);
                }
            }
            case PROMOTE -> {
                if (entity.getStatus() != GovernanceReleaseStatus.CANARY) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Only CANARY status can be promoted");
                }
                if (entity.isHasEvalGap()) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Cannot promote with eval gap");
                }
                if (entity.getRedteamStatus() == GovernanceRedteamStatus.FAIL) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Cannot promote with redteam FAIL");
                }
                if (entity.getMetricsDrift() == GovernanceMetricsDrift.MAJOR) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Cannot promote with metrics drift MAJOR");
                }
                entity.setStatus(GovernanceReleaseStatus.PROMOTED);
                entity.setCanaryPercent(100);
                entity.setPromotedAt(Instant.now());
            }
            case ROLLBACK -> {
                if (entity.getStatus() != GovernanceReleaseStatus.PROMOTED
                        && entity.getStatus() != GovernanceReleaseStatus.CANARY) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Only PROMOTED or CANARY status can rollback");
                }
                entity.setStatus(GovernanceReleaseStatus.ROLLED_BACK);
            }
            case DEPRECATE -> {
                if (entity.getStatus() == GovernanceReleaseStatus.DEPRECATED) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "Release is already deprecated");
                }
                entity.setStatus(GovernanceReleaseStatus.DEPRECATED);
            }
        }
        entity.setUpdatedBy(UUID.fromString(operator));
        Release saved = repository.save(entity);
        log.info(
                "Release acted: id={}, action={}, operator={}, tenantId={}",
                id, request.action(), operator, tenantId);
        return toDto(saved);
    }

    private void validateStepUp(ReleaseActionRequest request) {
        boolean requiresStepUp = request.action() == ReleaseActionRequest.Action.PROMOTE
                || request.action() == ReleaseActionRequest.Action.ROLLBACK
                || request.action() == ReleaseActionRequest.Action.DEPRECATE;
        if (requiresStepUp
                && (request.stepUpToken() == null || request.stepUpToken().isBlank())) {
            throw new BusinessException(
                    ErrorCode.FORBIDDEN,
                    HttpStatus.FORBIDDEN,
                    "Step-up authentication required for " + request.action());
        }
    }

    private String resolveOperator(HttpServletRequest httpRequest) {
        String userId = httpRequest.getHeader("x-user-id");
        if (userId == null || userId.isBlank()) {
            throw new BusinessException(
                    ErrorCode.UNAUTHORIZED,
                    HttpStatus.UNAUTHORIZED,
                    "x-user-id header required");
        }
        return userId;
    }

    private ReleaseDto toDto(Release entity) {
        ReleaseDiffSummary diff = entity.getDiffSummary();
        ReleaseDto.DiffSummary diffDto = new ReleaseDto.DiffSummary(
                diff.getAdded(), diff.getModified(), diff.getRemoved());
        return new ReleaseDto(
                entity.getId(),
                entity.getName(),
                entity.getType(),
                entity.getVersion(),
                entity.getPreviousVersion(),
                entity.getStatus(),
                entity.getReleaseManager(),
                entity.getCreatedAt(),
                entity.getPromotedAt(),
                entity.getEvalScore(),
                entity.getEvalSlices(),
                entity.getRedteamStatus(),
                entity.getConsumerCount(),
                entity.getCanaryPercent(),
                entity.getMetricsDrift(),
                entity.isHasEvalGap(),
                entity.isHasOldConsumer(),
                entity.getDescription(),
                diffDto
        );
    }
}
