package com.platform.core.governance.backup.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.governance.backup.dto.BackupCreateRequest;
import com.platform.core.governance.backup.dto.BackupPointDto;
import com.platform.core.governance.backup.dto.BackupRestoreRequest;
import com.platform.core.governance.backup.service.BackupService;
import com.platform.core.governance.domain.enums.GovernanceBackupStatus;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 治理域备份 Controller（D37.17 Backup/Restore）
 *
 * 路由：/api/v1/backups/**
 */
@RestController
@RequestMapping("/api/v1/backups")
public class BackupController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String DEFAULT_SORT_FIELD = "startedAt";

    private final BackupService backupService;
    private final TenantResolver tenantResolver;

    public BackupController(
            BackupService backupService,
            TenantResolver tenantResolver
    ) {
        this.backupService = backupService;
        this.tenantResolver = tenantResolver;
    }

    @GetMapping
    public PageResponse<BackupPointDto> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "desc") String order,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
        Sort.Direction direction = "asc".equalsIgnoreCase(order)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(
                safePage - 1, safeSize, Sort.by(direction, DEFAULT_SORT_FIELD));
        GovernanceBackupStatus statusEnum = parseStatus(status);
        Page<BackupPointDto> result = backupService.listBackups(
                tenantId, statusEnum, pageable);
        return PageResponse.success(
                result.getContent(), result.getTotalElements(), safePage, safeSize);
    }

    @GetMapping("/{id}")
    public ApiResponse<BackupPointDto> get(
            @PathVariable UUID id,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(backupService.getBackup(tenantId, id));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<BackupPointDto>> create(
            @Valid @RequestBody BackupCreateRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        BackupPointDto dto = backupService.createBackup(tenantId, request, httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(dto));
    }

    @PostMapping("/{id}/restore")
    public ApiResponse<BackupPointDto> restore(
            @PathVariable UUID id,
            @Valid @RequestBody BackupRestoreRequest request,
            HttpServletRequest httpRequest
    ) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        return ApiResponse.success(
                backupService.restoreBackup(tenantId, id, request, httpRequest));
    }

    private GovernanceBackupStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return GovernanceBackupStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
