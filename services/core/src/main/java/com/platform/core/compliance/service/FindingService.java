package com.platform.core.compliance.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.compliance.domain.ComplianceFinding;
import com.platform.core.compliance.dto.ComplianceFindingDto;
import com.platform.core.compliance.dto.CreateFindingRequest;
import com.platform.core.compliance.dto.FindingCommandRequest;
import com.platform.core.compliance.repository.ComplianceFindingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 合规发现服务（D45.22 缺陷治理 / D45.25 Finding API，SIT P0-13.1）
 *
 * 4 等级发布规则（验收）：
 *  - CRITICAL 必须修复并独立复测（RETEST 时 verifiedBy 与 owner 不同）
 *  - HIGH 默认阻断发布（isReleaseBlocked 判定 OPEN/IN_PROGRESS 状态阻断）
 */
@Service
public class FindingService {

    private static final Logger log = LoggerFactory.getLogger(FindingService.class);

    /** 合法严重等级（4 等级） */
    private static final Set<String> VALID_SEVERITIES = Set.of("CRITICAL", "HIGH", "MEDIUM", "LOW");

    private final ComplianceFindingRepository findingRepository;

    public FindingService(ComplianceFindingRepository findingRepository) {
        this.findingRepository = findingRepository;
    }

    @Transactional
    public ComplianceFindingDto create(UUID tenantId, CreateFindingRequest request) {
        validateSeverity(request.severity());

        ComplianceFinding finding = new ComplianceFinding();
        finding.setTenantId(tenantId);
        finding.setSeverity(request.severity());
        finding.setCategory(request.category());
        finding.setNote(request.note());
        finding.setResultId(request.resultId());
        finding.setRepro(request.repro());
        finding.setAffectedRequirement(request.affectedRequirement());
        finding.setArtifact(request.artifact());
        finding.setAssignedTo(request.assignedTo());
        if (request.rootState() != null && !request.rootState().isBlank()) {
            finding.setRootState(request.rootState());
        }
        finding.setSlaDueAt(request.slaDueAt());

        ComplianceFinding saved = findingRepository.save(finding);
        log.info("合规发现创建 tenantId={} findingId={} severity={}", tenantId, saved.getId(), saved.getSeverity());
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public ComplianceFindingDto getFinding(UUID tenantId, UUID findingId) {
        ComplianceFinding finding = loadFindingOrThrow(tenantId, findingId);
        return toDto(finding);
    }

    @Transactional(readOnly = true)
    public Page<ComplianceFindingDto> listFindings(UUID tenantId, String severity, String status, UUID assignedTo, Pageable pageable) {
        Page<ComplianceFinding> page;
        if (severity != null && !severity.isBlank()) {
            page = findingRepository.findByTenantIdAndSeverity(tenantId, severity, pageable);
        } else if (status != null && !status.isBlank()) {
            page = findingRepository.findByTenantIdAndStatus(tenantId, status, pageable);
        } else if (assignedTo != null) {
            page = findingRepository.findByTenantIdAndAssignedTo(tenantId, assignedTo, pageable);
        } else {
            page = findingRepository.findByTenantId(tenantId, pageable);
        }
        return page.map(this::toDto);
    }

    @Transactional
    public ComplianceFindingDto updateFinding(UUID tenantId, UUID findingId, FindingCommandRequest request) {
        ComplianceFinding finding = loadFindingOrThrow(tenantId, findingId);

        if (request.command() != null) {
            if ("RETEST".equals(request.command())) {
                // RETEST 走独立复测逻辑（含 CRITICAL 独立复测校验），直接返回避免二次 save
                return retest(tenantId, findingId, request);
            }
            applyCommand(finding, request.command(), request);
        }
        if (request.assignedTo() != null) {
            finding.setAssignedTo(request.assignedTo());
        }
        if (request.note() != null) {
            finding.setNote(request.note());
        }
        if (request.severity() != null && !request.severity().isBlank()) {
            validateSeverity(request.severity());
            finding.setSeverity(request.severity());
        }
        if (request.category() != null) {
            finding.setCategory(request.category());
        }
        if (request.repro() != null) {
            finding.setRepro(request.repro());
        }
        if (request.affectedRequirement() != null) {
            finding.setAffectedRequirement(request.affectedRequirement());
        }
        if (request.artifact() != null) {
            finding.setArtifact(request.artifact());
        }
        if (request.rootState() != null) {
            finding.setRootState(request.rootState());
        }
        if (request.owner() != null) {
            finding.setOwner(request.owner());
        }
        if (request.slaDueAt() != null) {
            finding.setSlaDueAt(request.slaDueAt());
        }
        if (request.fix() != null) {
            finding.setFix(request.fix());
        }
        if (request.verification() != null) {
            finding.setVerification(request.verification());
        }
        if (request.verifiedBy() != null) {
            finding.setVerifiedBy(request.verifiedBy());
        }

        ComplianceFinding saved = findingRepository.save(finding);
        log.info("更新合规发现 tenantId={} findingId={} status={}", tenantId, findingId, saved.getStatus());
        return toDto(saved);
    }

    /**
     * 独立复测（D45.25：POST /findings/{id}:retest）
     *
     * 验收：CRITICAL 必须修复并独立复测。
     *  - verification 与 verifiedBy 必填
     *  - CRITICAL 等级要求 verifiedBy 与 owner 不同（独立复测）
     */
    @Transactional
    public ComplianceFindingDto retest(UUID tenantId, UUID findingId, FindingCommandRequest request) {
        if (request.verification() == null || request.verification().isBlank()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "verification 复测结果是 retest 的必填字段");
        }
        if (request.verifiedBy() == null) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "verifiedBy 复测人是 retest 的必填字段");
        }

        ComplianceFinding finding = loadFindingOrThrow(tenantId, findingId);

        // CRITICAL 独立复测校验：复测人必须与修复责任人不同
        if ("CRITICAL".equals(finding.getSeverity())) {
            UUID effectiveOwner = finding.getOwner() != null ? finding.getOwner() : finding.getAssignedTo();
            if (effectiveOwner != null && effectiveOwner.equals(request.verifiedBy())) {
                throw new BusinessException(
                        ErrorCode.BUSINESS_RULE_VIOLATION,
                        HttpStatus.FORBIDDEN,
                        "CRITICAL 发现必须独立复测：verifiedBy 不得与 owner 相同");
            }
        }

        finding.setVerification(request.verification());
        finding.setVerifiedBy(request.verifiedBy());
        finding.setVerifiedAt(Instant.now());
        finding.setStatus("VERIFIED");
        finding.setRootState("FIXED");

        ComplianceFinding saved = findingRepository.save(finding);
        log.info("合规发现复测通过 tenantId={} findingId={} verifiedBy={}", tenantId, findingId, request.verifiedBy());
        return toDto(saved);
    }

    /**
     * 4 等级发布规则判定（D45.22 验收）：
     *  - CRITICAL 未关闭（CLOSED 以外）阻断发布
     *  - HIGH 处于 OPEN/IN_PROGRESS 阻断发布
     */
    @Transactional(readOnly = true)
    public boolean isReleaseBlocked(UUID tenantId) {
        long criticalOpen = findingRepository.countByTenantIdAndSeverityAndStatusNot(
                tenantId, "CRITICAL", "CLOSED");
        long highOpen = findingRepository.countByTenantIdAndSeverityAndStatusIn(
                tenantId, "HIGH", List.of("OPEN", "IN_PROGRESS"));
        return criticalOpen > 0 || highOpen > 0;
    }

    private void applyCommand(ComplianceFinding finding, String command, FindingCommandRequest request) {
        switch (command) {
            case "ASSIGN" -> finding.setStatus("IN_PROGRESS");
            case "VERIFY" -> {
                finding.setStatus("VERIFIED");
                finding.setRootState("FIXED");
            }
            case "CLOSE" -> finding.setStatus("CLOSED");
            case "REOPEN" -> finding.setStatus("OPEN");
            case "ESCALATE" -> {
                finding.setStatus("IN_PROGRESS");
                if ("MEDIUM".equals(finding.getSeverity())) {
                    finding.setSeverity("HIGH");
                } else if ("HIGH".equals(finding.getSeverity())) {
                    finding.setSeverity("CRITICAL");
                }
            }
            case "FIXED" -> {
                if (request.fix() == null || request.fix().isBlank()) {
                    throw new BusinessException(
                            ErrorCode.BUSINESS_RULE_VIOLATION,
                            "fix 修复方案是 FIXED 命令的必填字段");
                }
                finding.setFix(request.fix());
                finding.setStatus("FIXED");
                finding.setRootState("FIXED");
            }
            case "REGRESS" -> {
                finding.setStatus("OPEN");
                finding.setRootState("REGRESSED");
            }
            default -> throw new BusinessException(ErrorCode.PARAM_INVALID, "未知命令: " + command);
        }
    }

    private void validateSeverity(String severity) {
        if (!VALID_SEVERITIES.contains(severity)) {
            throw new BusinessException(
                    ErrorCode.PARAM_INVALID,
                    "severity must be one of: CRITICAL, HIGH, MEDIUM, LOW");
        }
    }

    private ComplianceFinding loadFindingOrThrow(UUID tenantId, UUID findingId) {
        return findingRepository.findById(findingId)
                .filter(f -> f.getTenantId().equals(tenantId))
                .orElseThrow(() -> new BusinessException(ErrorCode.FINDING_NOT_FOUND, "合规发现不存在: " + findingId));
    }

    private ComplianceFindingDto toDto(ComplianceFinding f) {
        return new ComplianceFindingDto(
                f.getId(),
                f.getTenantId(),
                f.getResultId(),
                f.getSeverity(),
                f.getStatus(),
                f.getAssignedTo(),
                f.getNote(),
                f.getCategory(),
                f.getRepro(),
                f.getAffectedRequirement(),
                f.getArtifact(),
                f.getRootState(),
                f.getOwner(),
                f.getSlaDueAt(),
                f.getFix(),
                f.getVerification(),
                f.getVerifiedBy(),
                f.getVerifiedAt(),
                f.getCreatedAt(),
                f.getUpdatedAt(),
                f.getCreatedBy(),
                f.getUpdatedBy(),
                f.getRowVersion()
        );
    }
}
