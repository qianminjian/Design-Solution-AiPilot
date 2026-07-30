package com.platform.core.analysis.solver.dto;

import java.util.UUID;

/**
 * 求解器配置 DTO（对齐前端 analysis.contract.ts SolverProfileDto）
 *
 * <p>V0 阶段：DTO 字段保持与前端契约一致（licenseType/available/estimatedCost/estimatedDurationMin）。
 * 后端 SolverProfile 实体保留新字段（maxConcurrentRuns/maxDurationSec/licensePool/isInternal/region/...），
 * 在 SolverProfileService.toDto() 中做字段映射。
 *
 * @design D37-关键界面-交互状态.md §D37.14
 */
public record SolverProfileDto(
        UUID id,
        String name,
        String version,
        String solverType,
        /** 许可证类型：floating / node_locked / cloud */
        String licenseType,
        /** 是否可用 */
        boolean available,
        /** 估算单次运行成本（单位：元） */
        java.math.BigDecimal estimatedCost,
        /** 估算运行时长（分钟） */
        int estimatedDurationMin
) {
}
