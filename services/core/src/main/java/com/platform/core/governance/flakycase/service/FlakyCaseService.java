package com.platform.core.governance.flakycase.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.flakycase.domain.FlakyCase;
import com.platform.core.governance.flakycase.domain.FlakyCaseStatus;
import com.platform.core.governance.flakycase.dto.FlakyCaseDto;
import com.platform.core.governance.flakycase.dto.FlakyIsolateRequest;
import com.platform.core.governance.flakycase.dto.FlakyReportRequest;
import com.platform.core.governance.flakycase.dto.FlakyResolveRequest;
import com.platform.core.governance.flakycase.repository.FlakyCaseRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Flaky Case 服务（D45.22 Flaky 治理，SIT P0-13.2）
 *
 * 检测机制（D45.22）：
 *  - 连续重复不稳定即隔离：连续 3 次结果翻转（consecutiveUnstable >= 3）→ FLAKY
 *  - 对应 Requirement 变为 Coverage Gap（isolate）
 *  - 保留替代确定性 TestCase（replacementCaseId 非空）才可不阻断发布
 *  - 修复必须有最小回归样本和根因分类（resolve）
 *
 * 验收：Flaky Case 率 < 5%（isFlakyRateExceeded 判定）
 */
@Service
public class FlakyCaseService {

    private static final Logger log = LoggerFactory.getLogger(FlakyCaseService.class);

    /** 连续不稳定阈值：连续 3 次结果翻转即隔离（D45.22） */
    private static final int FLAKY_THRESHOLD = 3;

    /** Flaky Case 率验收阈值：< 5%（D45.22 验收） */
    private static final double FLAKY_RATE_LIMIT = 0.05;

    private final FlakyCaseRepository repository;

    public FlakyCaseService(FlakyCaseRepository repository) {
        this.repository = repository;
    }

    /**
     * 上报一次运行结果并检测连续不稳定（D45.22 Flaky 检测机制）
     *
     * 结果翻转（与上次不同）则连续不稳定计数 +1，否则清零。
     * 连续 3 次翻转 → 状态 FLAKY（待隔离）。
     */
    @Transactional
    public FlakyCaseDto report(UUID tenantId, FlakyReportRequest request) {
        FlakyCase entity = repository.findByTenantIdAndTestCaseId(tenantId, request.testCaseId())
                .orElseGet(() -> {
                    FlakyCase fresh = new FlakyCase();
                    fresh.setTenantId(tenantId);
                    fresh.setTestCaseId(request.testCaseId());
                    fresh.setRequirementId(request.requirementId());
                    fresh.setTestRunId(request.testRunId());
                    return fresh;
                });

        boolean passed = Boolean.TRUE.equals(request.passed());
        entity.setRunCount(entity.getRunCount() + 1);

        // 连续不稳定检测：结果与上次翻转则计数 +1，否则清零
        if (entity.getLastResult() != null && entity.getLastResult() != passed) {
            entity.setInstabilityCount(entity.getInstabilityCount() + 1);
            entity.setConsecutiveUnstable(entity.getConsecutiveUnstable() + 1);
        } else {
            entity.setConsecutiveUnstable(0);
        }
        entity.setLastResult(passed);

        // 连续重复不稳定即隔离（D45.22）
        if (entity.getConsecutiveUnstable() >= FLAKY_THRESHOLD
                && entity.getStatus() != FlakyCaseStatus.ISOLATED
                && entity.getStatus() != FlakyCaseStatus.RESOLVED) {
            entity.setStatus(FlakyCaseStatus.FLAKY);
            log.warn("Flaky Case 检测：连续不稳定达到阈值 tenantId={} testCaseId={} consecutiveUnstable={}",
                    tenantId, request.testCaseId(), entity.getConsecutiveUnstable());
        }

        FlakyCase saved = repository.save(entity);
        log.info("Flaky Case 运行结果上报 tenantId={} testCaseId={} passed={} runCount={}",
                tenantId, request.testCaseId(), passed, saved.getRunCount());
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public FlakyCaseDto get(UUID tenantId, UUID id) {
        return toDto(findByIdAndTenant(tenantId, id));
    }

    @Transactional(readOnly = true)
    public Page<FlakyCaseDto> list(UUID tenantId, FlakyCaseStatus status, Pageable pageable) {
        Specification<FlakyCase> spec = (root, q, cb) ->
                cb.equal(root.get("tenantId"), tenantId);
        if (status != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        }
        return repository.findAll(spec, pageable).map(this::toDto);
    }

    /**
     * 隔离 Flaky Case（D45.22：对应 Requirement 变 Coverage Gap）
     *
     * 仅 FLAKY/TRACKED 状态可隔离。提供替代确定性 TestCase（replacementCaseId）
     * 则发布不阻断，否则视为覆盖缺口。
     */
    @Transactional
    public FlakyCaseDto isolate(UUID tenantId, UUID id, FlakyIsolateRequest request) {
        FlakyCase entity = findByIdAndTenant(tenantId, id);
        if (entity.getStatus() == FlakyCaseStatus.ISOLATED
                || entity.getStatus() == FlakyCaseStatus.RESOLVED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "仅 FLAKY/TRACKED 状态可隔离，当前状态: " + entity.getStatus());
        }
        entity.setStatus(FlakyCaseStatus.ISOLATED);
        entity.setReplacementCaseId(request.replacementCaseId());
        FlakyCase saved = repository.save(entity);
        log.info("Flaky Case 已隔离 tenantId={} id={} replacementCaseId={}",
                tenantId, id, request.replacementCaseId());
        return toDto(saved);
    }

    /**
     * 修复 Flaky Case（D45.22：修复必须有最小回归样本和根因分类）
     */
    @Transactional
    public FlakyCaseDto resolve(UUID tenantId, UUID id, FlakyResolveRequest request) {
        FlakyCase entity = findByIdAndTenant(tenantId, id);
        entity.setRootCause(request.rootCause());
        entity.setRegressionSample(request.regressionSample());
        entity.setStatus(FlakyCaseStatus.RESOLVED);
        FlakyCase saved = repository.save(entity);
        log.info("Flaky Case 已修复 tenantId={} id={} rootCause={}",
                tenantId, id, request.rootCause());
        return toDto(saved);
    }

    /**
     * Flaky Case 率验收判定（D45.22 验收：Flaky Case 率 < 5%）
     *
     * FLAKY + ISOLATED 数量 / 总数 > 5% → 阻断。
     */
    @Transactional(readOnly = true)
    public boolean isFlakyRateExceeded(UUID tenantId) {
        long flakyCount = repository.countByTenantIdAndStatusIn(
                tenantId, List.of(FlakyCaseStatus.FLAKY, FlakyCaseStatus.ISOLATED));
        long total = repository.countByTenantId(tenantId);
        if (total == 0) {
            return false;
        }
        double rate = (double) flakyCount / total;
        return rate > FLAKY_RATE_LIMIT;
    }

    private FlakyCase findByIdAndTenant(UUID tenantId, UUID id) {
        return repository.findById(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "FlakyCase not found: " + id));
    }

    private FlakyCaseDto toDto(FlakyCase e) {
        return new FlakyCaseDto(
                e.getId(),
                e.getStatus(),
                e.getTestCaseId(),
                e.getRequirementId(),
                e.getRunCount(),
                e.getInstabilityCount(),
                e.getConsecutiveUnstable(),
                e.getLastResult(),
                e.getRootCause(),
                e.getRegressionSample(),
                e.getReplacementCaseId(),
                e.getTestRunId(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
