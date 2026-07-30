package com.platform.core.analysis.solver.service;

import com.platform.core.analysis.solver.domain.SolverProfile;
import com.platform.core.analysis.solver.dto.SolverProfileDto;
import com.platform.core.analysis.solver.repository.SolverProfileRepository;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 求解器配置服务（D37.14 P10）
 *
 * <p>V0 阶段仅支持列表和详情查询，配置由 Flyway 初始化种子数据。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
@Service
public class SolverProfileService {

    private final SolverProfileRepository repository;

    public SolverProfileService(SolverProfileRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Page<SolverProfileDto> listProfiles(
            UUID tenantId,
            String solverType,
            Boolean isActive,
            int page,
            int pageSize
    ) {
        int safePage = Math.max(0, page - 1);
        int safeSize = Math.min(Math.max(1, pageSize), 100);
        Pageable pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<SolverProfile> result;
        if (solverType != null && !solverType.isBlank()) {
            result = repository.findByTenantIdAndSolverType(tenantId, solverType, pageable);
        } else if (isActive != null) {
            result = repository.findByTenantIdAndActive(tenantId, isActive, pageable);
        } else {
            result = repository.findByTenantId(tenantId, pageable);
        }
        return result.map(this::toDto);
    }

    @Transactional(readOnly = true)
    public SolverProfileDto getProfile(UUID tenantId, UUID id) {
        SolverProfile entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND,
                        HttpStatus.NOT_FOUND,
                        "SolverProfile not found: " + id));
        return toDto(entity);
    }

    // ── 实体 → DTO ──
    //
    // V0 字段映射：实体保留新字段（maxConcurrentRuns/maxDurationSec/licensePool/isInternal/region/...），
    // DTO 返回旧字段（licenseType/available/estimatedCost/estimatedDurationMin）以对齐前端契约。
    // 后续前端契约升级后，可直接返回新字段。

    public SolverProfileDto toDto(SolverProfile entity) {
        // licenseType 派生：内部求解器默认 floating，外部 Provider 默认 cloud
        String licenseType = entity.isInternal() ? "floating" : "cloud";
        // estimatedDurationMin: maxDurationSec / 60（向上取整）
        int estimatedDurationMin = Math.max(1, (entity.getMaxDurationSec() + 59) / 60);
        // estimatedCost V0 简化：内部求解器 0，外部按 licensePool 派生（暂为 0）
        java.math.BigDecimal estimatedCost = java.math.BigDecimal.ZERO;

        return new SolverProfileDto(
                entity.getId(),
                entity.getName(),
                entity.getVersion(),
                entity.getSolverType(),
                licenseType,
                entity.isActive(),
                estimatedCost,
                estimatedDurationMin
        );
    }
}
