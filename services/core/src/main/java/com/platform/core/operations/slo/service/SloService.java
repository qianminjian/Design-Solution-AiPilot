package com.platform.core.operations.slo.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.operations.domain.enums.SloStatus;
import com.platform.core.operations.slo.domain.SloTarget;
import com.platform.core.operations.slo.dto.SloTargetDto;
import com.platform.core.operations.slo.repository.SloTargetRepository;
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

import java.math.BigDecimal;
import java.util.UUID;

/**
 * SLO 服务（D37.17 运营中心）
 *
 * 核心操作：
 *  - listSlos：按租户/状态查询 SLO 列表
 *  - getSlo：单条详情
 *  - createSlo：创建 SLO 目标
 *  - updateSlo：更新 SLO 目标
 *
 * V0 简化：
 *  - 实际指标采集（availabilityCurrent/errorBudgetRemaining/p95/p99）由 V1 接入 Prometheus
 *  - SLO 状态自动计算由 V1 实现（基于错误预算消耗速率）
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D42-SLO-容量.md
 */
@Service
public class SloService {

    private static final Logger log = LoggerFactory.getLogger(SloService.class);

    private final SloTargetRepository repository;

    public SloService(SloTargetRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Page<SloTargetDto> listSlos(UUID tenantId, SloStatus status, Integer page, Integer pageSize) {
        int safePage = page != null && page > 0 ? page - 1 : 0;
        int safeSize = pageSize != null && pageSize > 0 ? pageSize : 20;
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "updatedAt"));

        Specification<SloTarget> spec = (root, query, cb) ->
                cb.equal(root.get("tenantId"), tenantId);

        if (status != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("status"), status));
        }

        return repository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public SloTargetDto getSlo(UUID tenantId, UUID id) {
        SloTarget entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "SloTarget not found: " + id));
        return toDto(entity);
    }

    @Transactional
    public SloTargetDto createSlo(UUID tenantId, SloTargetDto request) {
        SloTarget entity = new SloTarget();
        entity.setTenantId(tenantId);
        entity.setName(request.name());
        entity.setAvailabilityTarget(request.availabilityTarget());
        entity.setAvailabilityCurrent(request.availabilityCurrent() != null
                ? request.availabilityCurrent() : BigDecimal.ZERO);
        entity.setErrorBudgetRemaining(request.errorBudgetRemaining() != null
                ? request.errorBudgetRemaining() : BigDecimal.ZERO);
        entity.setRequestCount24h(request.requestCount24h());
        entity.setErrorCount24h(request.errorCount24h());
        entity.setP95LatencyMs(request.p95LatencyMs());
        entity.setP99LatencyMs(request.p99LatencyMs());
        entity.setStatus(request.status() != null ? request.status() : SloStatus.HEALTHY);

        SloTarget saved = repository.save(entity);
        log.info("SloTarget created: id={}, tenantId={}, name={}", saved.getId(), tenantId, saved.getName());
        return toDto(saved);
    }

    @Transactional
    public SloTargetDto updateSlo(UUID tenantId, UUID id, SloTargetDto request) {
        SloTarget entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "SloTarget not found: " + id));

        if (request.name() != null) {
            entity.setName(request.name());
        }
        if (request.availabilityTarget() != null) {
            entity.setAvailabilityTarget(request.availabilityTarget());
        }
        if (request.availabilityCurrent() != null) {
            entity.setAvailabilityCurrent(request.availabilityCurrent());
        }
        if (request.errorBudgetRemaining() != null) {
            entity.setErrorBudgetRemaining(request.errorBudgetRemaining());
        }
        entity.setRequestCount24h(request.requestCount24h());
        entity.setErrorCount24h(request.errorCount24h());
        entity.setP95LatencyMs(request.p95LatencyMs());
        entity.setP99LatencyMs(request.p99LatencyMs());
        if (request.status() != null) {
            entity.setStatus(request.status());
        }

        SloTarget saved = repository.save(entity);
        return toDto(saved);
    }

    private SloTargetDto toDto(SloTarget entity) {
        return new SloTargetDto(
                entity.getId(),
                entity.getName(),
                entity.getAvailabilityTarget(),
                entity.getAvailabilityCurrent(),
                entity.getErrorBudgetRemaining(),
                entity.getRequestCount24h(),
                entity.getErrorCount24h(),
                entity.getP95LatencyMs(),
                entity.getP99LatencyMs(),
                entity.getStatus(),
                entity.getUpdatedAt()
        );
    }
}
