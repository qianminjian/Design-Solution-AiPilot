package com.platform.core.governance.qualitygate.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.qualitygate.domain.QualityGate;
import com.platform.core.governance.qualitygate.domain.QualityGateLevel;
import com.platform.core.governance.qualitygate.domain.QualityGateStatus;
import com.platform.core.governance.qualitygate.dto.QualityGateCreateRequest;
import com.platform.core.governance.qualitygate.dto.QualityGateDto;
import com.platform.core.governance.qualitygate.dto.QualityGateSignRequest;
import com.platform.core.governance.qualitygate.repository.QualityGateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * 质量门禁服务（D45.23 质量门禁与验收签署，SIT P0-13.4）
 *
 * 验收：
 *  - 每 Gate 签署角色落实（signerRole 必填）
 *  - AI 不代签（signerRole 拒绝 AI/AGENT/SYSTEM 角色，aiSigned 恒 false）
 *  - 任何签署均是责任人的决定，平台/AI 只聚合证据、检查完整性和记录签名
 */
@Service
public class QualityGateService {

    private static final Logger log = LoggerFactory.getLogger(QualityGateService.class);

    /** AI 代签禁用角色（AI 不代签红线，D45.23 Production Promotion 明确要求） */
    private static final Set<String> AI_SIGNER_ROLES = Set.of("AI", "AGENT", "SYSTEM", "BOT");

    private final QualityGateRepository repository;

    public QualityGateService(QualityGateRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public QualityGateDto create(UUID tenantId, QualityGateCreateRequest request) {
        QualityGateLevel level = parseLevel(request.gateLevel());

        QualityGate entity = new QualityGate();
        entity.setTenantId(tenantId);
        entity.setGateLevel(level);
        entity.setVersionTarget(request.versionTarget());
        entity.setStatus(QualityGateStatus.NOT_STARTED);
        entity.setChecks(checksFor(level));

        QualityGate saved = repository.save(entity);
        log.info("质量门禁创建 tenantId={} id={} gateLevel={} versionTarget={}",
                tenantId, saved.getId(), level, request.versionTarget());
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public QualityGateDto get(UUID tenantId, UUID id) {
        return toDto(findByIdAndTenant(tenantId, id));
    }

    @Transactional(readOnly = true)
    public Page<QualityGateDto> list(UUID tenantId, QualityGateStatus status, Pageable pageable) {
        Specification<QualityGate> spec = (root, q, cb) ->
                cb.equal(root.get("tenantId"), tenantId);
        if (status != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        }
        return repository.findAll(spec, pageable).map(this::toDto);
    }

    /**
     * 门禁签署（D45.23：每 Gate 签署角色落实，AI 不代签）
     *
     *  - signerRole 必填且拒绝 AI/AGENT/SYSTEM 角色（AI 不代签红线）
     *  - decision=PASS → PASSED / FAIL → FAILED
     *  - 记录签署人、签署时间与角色
     */
    @Transactional
    public QualityGateDto sign(UUID tenantId, UUID id, QualityGateSignRequest request) {
        validateSignerRole(request.signerRole());

        QualityGate entity = findByIdAndTenant(tenantId, id);
        if (entity.getStatus() == QualityGateStatus.PASSED
                || entity.getStatus() == QualityGateStatus.FAILED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "门禁已签署不可重复签署，当前状态: " + entity.getStatus());
        }

        entity.setSignerRole(request.signerRole());
        entity.setSignedBy(request.signedBy());
        entity.setSignedAt(Instant.now());
        entity.setDecision(request.decision());
        entity.setAiSigned(false);
        entity.setStatus("PASS".equals(request.decision())
                ? QualityGateStatus.PASSED
                : QualityGateStatus.FAILED);

        QualityGate saved = repository.save(entity);
        log.info("质量门禁签署 tenantId={} id={} gateLevel={} decision={} signerRole={}",
                tenantId, id, saved.getGateLevel(), request.decision(), request.signerRole());
        return toDto(saved);
    }

    private void validateSignerRole(String signerRole) {
        String upper = signerRole.toUpperCase(Locale.ROOT);
        if (AI_SIGNER_ROLES.contains(upper)) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    HttpStatus.FORBIDDEN,
                    "AI 不代签：签署角色不得为 " + upper + "（D45.23 AI 不代签红线）");
        }
    }

    /** 6 级 Gate 预置检查项（D45.23 必要证据） */
    private String checksFor(QualityGateLevel level) {
        return switch (level) {
            case PR_MERGE -> """
                    [{"name":"static-unit","requiredEvidence":"static/unit/property/component","result":"pending"},
                     {"name":"coverage-quality","requiredEvidence":"coverage/quality","result":"pending"},
                     {"name":"security-quick-scan","requiredEvidence":"security quick scan","result":"pending"}]
                    """;
            case INTEGRATION -> """
                    [{"name":"contract","requiredEvidence":"contract/integration/migration","result":"pending"},
                     {"name":"golden-smoke","requiredEvidence":"critical Golden smoke","result":"pending"}]
                    """;
            case RELEASE_CANDIDATE -> """
                    [{"name":"full-regression","requiredEvidence":"full regression","result":"pending"},
                     {"name":"golden-sample","requiredEvidence":"professional golden sample","result":"pending"},
                     {"name":"ai-tevv","requiredEvidence":"AI TEVV","result":"pending"},
                     {"name":"security-perf-reliability","requiredEvidence":"security/performance/reliability","result":"pending"},
                     {"name":"compatibility","requiredEvidence":"compatibility","result":"pending"}]
                    """;
            case PREPROD -> """
                    [{"name":"e2e-production-equiv","requiredEvidence":"production-equivalent E2E","result":"pending"},
                     {"name":"upgrade-rollback","requiredEvidence":"upgrade/rollback","result":"pending"},
                     {"name":"restore","requiredEvidence":"restore drill","result":"pending"},
                     {"name":"canary","requiredEvidence":"canary","result":"pending"},
                     {"name":"ops-drill","requiredEvidence":"operations drill","result":"pending"}]
                    """;
            case PILOT_UAT -> """
                    [{"name":"scenario-scripts","requiredEvidence":"scenario scripts","result":"pending"},
                     {"name":"user-professional-conclusion","requiredEvidence":"user/professional conclusion","result":"pending"},
                     {"name":"training-support","requiredEvidence":"training support","result":"pending"},
                     {"name":"residual-risk","requiredEvidence":"residual risk","result":"pending"}]
                    """;
            case PRODUCTION_PROMOTION -> """
                    [{"name":"critical-trace-coverage","requiredEvidence":"Critical Verification Trace Coverage=100%","result":"pending"},
                     {"name":"signed-bundle","requiredEvidence":"signed Bundle","result":"pending"},
                     {"name":"go-no-go","requiredEvidence":"Go/No-Go","result":"pending"}]
                    """;
        };
    }

    private QualityGateLevel parseLevel(String level) {
        try {
            return QualityGateLevel.valueOf(level.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new BusinessException(
                    ErrorCode.PARAM_INVALID,
                    "invalid gateLevel: " + level + ", expected one of: " + List.of(QualityGateLevel.values()));
        }
    }

    private QualityGate findByIdAndTenant(UUID tenantId, UUID id) {
        return repository.findById(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "QualityGate not found: " + id));
    }

    private QualityGateDto toDto(QualityGate e) {
        return new QualityGateDto(
                e.getId(),
                e.getGateLevel(),
                e.getStatus(),
                e.getVersionTarget(),
                e.getChecks(),
                e.getSignerRole(),
                e.getSignedBy(),
                e.getSignedAt(),
                e.getDecision(),
                e.isAiSigned(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
