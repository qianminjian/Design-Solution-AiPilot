package com.platform.core.portfolio.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/**
 * 更新项目请求（部分更新，对齐 portfolio.contract.ts §UpdateProjectRequest）
 *
 * <p>仅非 null 字段被更新；code 与 tenantId 不可变更</p>
 */
public record UpdateProjectRequest(
        @Size(max = 255, message = "项目名称长度不能超过 255")
        String name,

        @Size(max = 2000, message = "描述长度不能超过 2000")
        String description,

        /** 项目状态：ACTIVE / ON_HOLD / COMPLETED / CANCELLED / ARCHIVED */
        String status,

        /** 建筑类型 */
        String buildingType,

        @Min(value = 1, message = "最小层数必须 ≥ 1")
        Integer floorsMin,

        @Min(value = 1, message = "最大层数必须 ≥ 1")
        Integer floorsMax,

        BigDecimal gfa,

        BigDecimal siteArea,

        Map<String, Object> settings,

        Map<String, Object> metadata,

        Instant startedAt,

        Instant targetCompletionAt
) {
}
