package com.platform.core.governance.restore.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.domain.enums.GovernanceRestoreDrillStatus;
import com.platform.core.governance.restore.domain.RestoreDrill;
import com.platform.core.governance.restore.dto.RestoreDrillCreateRequest;
import com.platform.core.governance.restore.dto.RestoreDrillDto;
import com.platform.core.governance.restore.repository.RestoreDrillRepository;
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
 * 治理域灾备演练服务（D37.17 灾备演练）
 *
 * V1 简化：创建后状态为 SCHEDULED（如有 scheduledAt）或 RUNNING（立即开始）。
 * 实际恢复由外部脚本执行，完成后由回调更新状态。
 */
@Service
public class RestoreDrillService {

    private static final Logger log = LoggerFactory.getLogger(RestoreDrillService.class);

    private final RestoreDrillRepository repository;

    public RestoreDrillService(RestoreDrillRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Page<RestoreDrillDto> listRestoreDrills(
            UUID tenantId,
            GovernanceRestoreDrillStatus status,
            Pageable pageable
    ) {
        Specification<RestoreDrill> spec = (root, q, cb) ->
                cb.equal(root.get("tenantId"), tenantId);
        if (status != null) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("status"), status));
        }
        return repository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public RestoreDrillDto getRestoreDrill(UUID tenantId, UUID id) {
        RestoreDrill entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "RestoreDrill not found: " + id));
        return toDto(entity);
    }

    @Transactional
    public RestoreDrillDto createRestoreDrill(
            UUID tenantId,
            RestoreDrillCreateRequest request
    ) {
        if (request.stepUpToken() == null || request.stepUpToken().isBlank()) {
            throw new BusinessException(
                    ErrorCode.FORBIDDEN,
                    HttpStatus.FORBIDDEN,
                    "Step-up authentication required for restore drill");
        }

        RestoreDrill entity = new RestoreDrill();
        entity.setBackupId(request.backupId());
        entity.setTarget(request.target().name().toLowerCase());
        entity.setVerifier(request.operator());
        entity.setTenantId(tenantId);

        if (request.scheduledAt() != null) {
            entity.setStartedAt(request.scheduledAt());
            entity.setStatus(GovernanceRestoreDrillStatus.SCHEDULED);
        } else {
            entity.setStartedAt(Instant.now());
            entity.setStatus(GovernanceRestoreDrillStatus.RUNNING);
        }

        RestoreDrill saved = repository.save(entity);
        log.info(
                "RestoreDrill created: id={}, backupId={}, target={}, operator={}, tenantId={}",
                saved.getId(), request.backupId(), request.target(),
                request.operator(), tenantId);
        return toDto(saved);
    }

    private RestoreDrillDto toDto(RestoreDrill entity) {
        return new RestoreDrillDto(
                entity.getId(),
                entity.getBackupId(),
                entity.getTarget(),
                entity.getStatus(),
                entity.getStartedAt(),
                entity.getCompletedAt(),
                entity.getActualRtoMin(),
                entity.getActualRpoMin(),
                entity.getVerifier(),
                entity.getReportUrl(),
                entity.getPassed(),
                entity.getNotes()
        );
    }
}
