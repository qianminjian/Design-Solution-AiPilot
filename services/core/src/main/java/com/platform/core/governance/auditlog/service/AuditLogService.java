package com.platform.core.governance.auditlog.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.auditlog.domain.AuditActor;
import com.platform.core.governance.auditlog.domain.AuditLog;
import com.platform.core.governance.auditlog.domain.AuditObject;
import com.platform.core.governance.auditlog.dto.AuditLogDto;
import com.platform.core.governance.auditlog.dto.AuditLogQuery;
import com.platform.core.governance.auditlog.repository.AuditLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 治理域审计日志服务（D37.17 Audit/Evidence）
 *
 * 查询为主，写操作由 A-12 审计日志中间件自动填充。
 */
@Service
public class AuditLogService {

    private final AuditLogRepository repository;

    public AuditLogService(AuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Page<AuditLogDto> listAuditLogs(UUID tenantId, AuditLogQuery query, Pageable pageable) {
        Specification<AuditLog> spec = (root, q, cb) ->
                cb.equal(root.get("tenantId"), tenantId);
        if (query != null) {
            spec = appendQuery(spec, query);
        }
        return repository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public AuditLogDto getAuditLog(UUID tenantId, UUID id) {
        AuditLog entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "AuditLog not found: " + id));
        return toDto(entity);
    }

    private Specification<AuditLog> appendQuery(Specification<AuditLog> spec, AuditLogQuery query) {
        if (query.category() != null) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("category"), query.category()));
        }
        if (query.result() != null) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("result"), query.result()));
        }
        if (query.riskLevel() != null) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("riskLevel"), query.riskLevel()));
        }
        if (query.actorId() != null && !query.actorId().isBlank()) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("actor").get("id"), query.actorId()));
        }
        if (query.traceId() != null && !query.traceId().isBlank()) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("traceId"), query.traceId()));
        }
        if (query.from() != null) {
            spec = spec.and((root, q, cb) ->
                    cb.greaterThanOrEqualTo(root.get("timestamp"), query.from()));
        }
        if (query.to() != null) {
            spec = spec.and((root, q, cb) ->
                    cb.lessThanOrEqualTo(root.get("timestamp"), query.to()));
        }
        // P0-1.2 测试数据隔离：excludeTestRun 优先于 testRunId
        if (Boolean.TRUE.equals(query.excludeTestRun())) {
            spec = spec.and((root, q, cb) ->
                    cb.isNull(root.get("testRunId")));
        } else if (query.testRunId() != null && !query.testRunId().isBlank()) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("testRunId"), query.testRunId()));
        }
        return spec;
    }

    private AuditLogDto toDto(AuditLog entity) {
        AuditActor actor = entity.getActor();
        AuditObject object = entity.getObject();
        return new AuditLogDto(
                entity.getId(),
                entity.getTimestamp(),
                new AuditLogDto.Actor(
                        actor.getId(), actor.getName(), actor.getType()),
                entity.getAction(),
                entity.getCategory(),
                new AuditLogDto.AuditObject(
                        object.getType(), object.getId(), object.getName()),
                entity.getTraceId(),
                entity.getResult(),
                entity.getRiskLevel(),
                entity.isMasked(),
                entity.getIpAddress(),
                entity.getUserAgent(),
                entity.getDetails(),
                entity.getTestRunId()
        );
    }
}
