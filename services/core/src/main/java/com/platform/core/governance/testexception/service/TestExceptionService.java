package com.platform.core.governance.testexception.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.testexception.domain.TestException;
import com.platform.core.governance.testexception.domain.TestExceptionStatus;
import com.platform.core.governance.testexception.dto.TestExceptionCreateRequest;
import com.platform.core.governance.testexception.dto.TestExceptionDto;
import com.platform.core.governance.testexception.dto.TestExceptionRevokeRequest;
import com.platform.core.governance.testexception.repository.TestExceptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/**
 * 测试例外服务（D45.22 例外治理 / D45.25 TestException API，SIT P0-13.3）
 *
 * 验收：
 *  - 例外有签署（创建时 approvers JSON 必填且含 signedAt 时间戳，直接 ACTIVE）
 *  - Conditional Pass 到期自动撤销（expiry < now 且 ACTIVE → EXPIRED，由调度器触发）
 *  - 版本升级不自动继承（versionTarget 绑定，新版本需重新申请）
 */
@Service
public class TestExceptionService {

    private static final Logger log = LoggerFactory.getLogger(TestExceptionService.class);

    /** 合法风险等级（对齐 security.md §12 AI 安全红线风险分级） */
    private static final Set<String> VALID_RISKS = Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL");

    private final TestExceptionRepository repository;

    public TestExceptionService(TestExceptionRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public TestExceptionDto create(UUID tenantId, TestExceptionCreateRequest request) {
        validateRisk(request.risk());
        validateApprovers(request.approvers());
        if (!request.expiry().isAfter(Instant.now())) {
            throw new BusinessException(
                    ErrorCode.PARAM_INVALID,
                    "expiry 到期时间必须晚于当前时间");
        }

        TestException entity = new TestException();
        entity.setTenantId(tenantId);
        entity.setScope(request.scope());
        entity.setReason(request.reason());
        entity.setRisk(request.risk());
        entity.setCompensation(request.compensation());
        entity.setApprovers(request.approvers());
        entity.setExpiry(request.expiry());
        entity.setRetestTrigger(request.retestTrigger());
        entity.setResidualRisk(request.residualRisk());
        entity.setVersionTarget(request.versionTarget());
        entity.setTestRunId(request.testRunId());
        // 签署完成即生效（例外有签署验收）
        entity.setStatus(TestExceptionStatus.ACTIVE);

        TestException saved = repository.save(entity);
        log.info("测试例外创建 tenantId={} id={} risk={} expiry={}",
                tenantId, saved.getId(), saved.getRisk(), saved.getExpiry());
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public TestExceptionDto get(UUID tenantId, UUID id) {
        return toDto(findByIdAndTenant(tenantId, id));
    }

    @Transactional(readOnly = true)
    public Page<TestExceptionDto> list(UUID tenantId, TestExceptionStatus status, Pageable pageable) {
        Specification<TestException> spec = (root, q, cb) ->
                cb.equal(root.get("tenantId"), tenantId);
        if (status != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        }
        return repository.findAll(spec, pageable).map(this::toDto);
    }

    /**
     * 撤销例外（D45.25：POST /test-exceptions/{id}:revoke）
     *
     * 仅 ACTIVE/PENDING_REVIEW 可撤销。
     */
    @Transactional
    public TestExceptionDto revoke(UUID tenantId, UUID id, TestExceptionRevokeRequest request) {
        TestException entity = findByIdAndTenant(tenantId, id);
        if (entity.getStatus() != TestExceptionStatus.ACTIVE
                && entity.getStatus() != TestExceptionStatus.PENDING_REVIEW) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "仅 ACTIVE/PENDING_REVIEW 状态的例外可撤销，当前状态: " + entity.getStatus());
        }
        entity.setStatus(TestExceptionStatus.REVOKED);
        TestException saved = repository.save(entity);
        log.info("测试例外撤销 tenantId={} id={} reason={}",
                tenantId, id, request.reason());
        return toDto(saved);
    }

    /**
     * 到期自动撤销（Conditional Pass 到期自动撤销验收）
     *
     * 由 TestExceptionExpirationScheduler 定时触发：ACTIVE 且 expiry < now → EXPIRED。
     */
    @Transactional
    public int expireOverdue(Instant now) {
        int affected = repository.bulkMarkExpired(
                TestExceptionStatus.ACTIVE, TestExceptionStatus.EXPIRED, now);
        if (affected > 0) {
            log.info("测试例外到期自动撤销 affected={} now={}", affected, now);
        }
        return affected;
    }

    private void validateRisk(String risk) {
        if (!VALID_RISKS.contains(risk)) {
            throw new BusinessException(
                    ErrorCode.PARAM_INVALID,
                    "risk must be one of: LOW, MEDIUM, HIGH, CRITICAL");
        }
    }

    /** 例外有签署校验：approvers JSON 非空且包含 signedAt 签署时间戳 */
    private void validateApprovers(String approvers) {
        if (approvers == null || approvers.isBlank()) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "approvers 签署人列表是必填字段（例外有签署验收）");
        }
        if (!approvers.contains("signedAt")) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "approvers 必须包含 signedAt 签署时间戳（例外有签署验收）");
        }
    }

    private TestException findByIdAndTenant(UUID tenantId, UUID id) {
        return repository.findById(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "TestException not found: " + id));
    }

    private TestExceptionDto toDto(TestException e) {
        return new TestExceptionDto(
                e.getId(),
                e.getStatus(),
                e.getScope(),
                e.getReason(),
                e.getRisk(),
                e.getCompensation(),
                e.getApprovers(),
                e.getExpiry(),
                e.getRetestTrigger(),
                e.getResidualRisk(),
                e.getVersionTarget(),
                e.getTestRunId(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
