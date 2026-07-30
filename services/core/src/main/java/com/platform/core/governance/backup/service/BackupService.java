package com.platform.core.governance.backup.service;

import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.governance.backup.domain.BackupPoint;
import com.platform.core.governance.backup.dto.BackupCreateRequest;
import com.platform.core.governance.backup.dto.BackupPointDto;
import com.platform.core.governance.backup.dto.BackupRestoreRequest;
import com.platform.core.governance.backup.repository.BackupPointRepository;
import com.platform.core.governance.domain.enums.GovernanceBackupScope;
import com.platform.core.governance.domain.enums.GovernanceBackupStatus;
import com.platform.core.governance.domain.enums.GovernanceBackupType;
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
 * 治理域备份服务（D37.17 Backup/Restore）
 *
 * V1 简化：创建备份仅记录元数据，实际备份由外部脚本（pg_dump / aws s3 sync）异步执行。
 * 完成后由回调接口更新状态与统计字段。
 */
@Service
public class BackupService {

    private static final Logger log = LoggerFactory.getLogger(BackupService.class);

    private final BackupPointRepository repository;

    public BackupService(BackupPointRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Page<BackupPointDto> listBackups(
            UUID tenantId,
            GovernanceBackupStatus status,
            Pageable pageable
    ) {
        Specification<BackupPoint> spec = (root, q, cb) ->
                cb.equal(root.get("tenantId"), tenantId);
        if (status != null) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("status"), status));
        }
        return repository.findAll(spec, pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public BackupPointDto getBackup(UUID tenantId, UUID id) {
        BackupPoint entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "BackupPoint not found: " + id));
        return toDto(entity);
    }

    @Transactional
    public BackupPointDto createBackup(
            UUID tenantId,
            BackupCreateRequest request,
            HttpServletRequest httpRequest
    ) {
        String operator = resolveOperator(httpRequest);
        BackupPoint entity = new BackupPoint();
        entity.setType(request.type());
        entity.setScope(request.scope());
        entity.setStartedAt(Instant.now());
        entity.setStatus(GovernanceBackupStatus.RUNNING);
        entity.setSizeBytes(0);
        entity.setObjectCount(0);
        entity.setActualRpoMin(0);
        entity.setStorageLocation(resolveStorageLocation(tenantId, request.scope()));
        entity.setHash("pending-" + UUID.randomUUID());
        entity.setTriggeredBy(operator);
        entity.setTenantId(tenantId);
        entity.setCreatedBy(UUID.fromString(operator));
        BackupPoint saved = repository.save(entity);
        log.info(
                "Backup created: id={}, type={}, scope={}, operator={}, tenantId={}",
                saved.getId(), request.type(), request.scope(), operator, tenantId);
        return toDto(saved);
    }

    @Transactional
    public BackupPointDto restoreBackup(
            UUID tenantId,
            UUID id,
            BackupRestoreRequest request,
            HttpServletRequest httpRequest
    ) {
        BackupPoint entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "BackupPoint not found: " + id));

        if (request.target() == BackupRestoreRequest.Target.PRODUCTION
                && (request.stepUpToken() == null || request.stepUpToken().isBlank())) {
            throw new BusinessException(
                    ErrorCode.FORBIDDEN,
                    HttpStatus.FORBIDDEN,
                    "Step-up authentication required for PRODUCTION restore");
        }
        if (entity.getStatus() != GovernanceBackupStatus.VERIFIED
                && entity.getStatus() != GovernanceBackupStatus.COMPLETED) {
            throw new BusinessException(
                    ErrorCode.BUSINESS_RULE_VIOLATION,
                    "Only COMPLETED or VERIFIED backups can be restored");
        }
        String operator = resolveOperator(httpRequest);
        log.info(
                "Backup restored: id={}, target={}, operator={}, tenantId={}",
                id, request.target(), operator, tenantId);
        return toDto(entity);
    }

    private String resolveStorageLocation(UUID tenantId, GovernanceBackupScope scope) {
        return "s3://backups/" + tenantId + "/" + scope.name().toLowerCase()
                + "/" + Instant.now().toEpochMilli();
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

    private BackupPointDto toDto(BackupPoint entity) {
        return new BackupPointDto(
                entity.getId(),
                entity.getType(),
                entity.getScope(),
                entity.getStartedAt(),
                entity.getCompletedAt(),
                entity.getDurationSec(),
                entity.getSizeBytes(),
                entity.getObjectCount(),
                entity.getStatus(),
                entity.getActualRpoMin(),
                entity.getStorageLocation(),
                entity.getHash(),
                entity.getTriggeredBy()
        );
    }
}
