package com.platform.core.compliance.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.compliance.domain.ComplianceFinding;
import com.platform.core.compliance.dto.ComplianceFindingDto;
import com.platform.core.compliance.dto.FindingCommandRequest;
import com.platform.core.compliance.repository.ComplianceFindingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class FindingService {

    private static final Logger log = LoggerFactory.getLogger(FindingService.class);

    private final ComplianceFindingRepository findingRepository;

    public FindingService(ComplianceFindingRepository findingRepository) {
        this.findingRepository = findingRepository;
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
            applyCommand(finding, request.command());
        }
        if (request.assignedTo() != null) {
            finding.setAssignedTo(request.assignedTo());
        }
        if (request.note() != null) {
            finding.setNote(request.note());
        }

        ComplianceFinding saved = findingRepository.save(finding);
        log.info("更新合规发现 tenantId={} findingId={} status={}", tenantId, findingId, saved.getStatus());
        return toDto(saved);
    }

    private void applyCommand(ComplianceFinding finding, String command) {
        switch (command) {
            case "ASSIGN" -> finding.setStatus("IN_PROGRESS");
            case "VERIFY" -> finding.setStatus("VERIFIED");
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
            default -> throw new BusinessException(ErrorCode.PARAM_INVALID, "未知命令: " + command);
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
                f.getCreatedAt(),
                f.getUpdatedAt(),
                f.getCreatedBy(),
                f.getUpdatedBy(),
                f.getRowVersion()
        );
    }
}