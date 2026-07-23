package com.platform.core.portfolio.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 创建项目请求（对齐 portfolio.contract.ts §CreateProjectRequest）
 *
 * <p>核心校验：
 * <ul>
 *   <li>name/code 非空</li>
 *   <li>code 长度 ≤ 100，租户内唯一（服务层校验）</li>
 *   <li>floorsMin ≤ floorsMax</li>
 * </ul>
 */
public record CreateProjectRequest(
        @NotBlank(message = "项目名称不能为空")
        @Size(max = 255, message = "项目名称长度不能超过 255")
        String name,

        @NotBlank(message = "项目编码不能为空")
        @Size(max = 100, message = "项目编码长度不能超过 100")
        String code,

        /** 所属组织 ID（可空） */
        UUID organizationId,

        @Size(max = 2000, message = "描述长度不能超过 2000")
        String description,

        /** 建筑类型：OFFICE / RESIDENTIAL / COMMERCIAL / MIXED */
        String buildingType,

        @Min(value = 1, message = "最小层数必须 ≥ 1")
        Integer floorsMin,

        @Min(value = 1, message = "最大层数必须 ≥ 1")
        Integer floorsMax,

        /** 总建筑面积 GFA（m²） */
        BigDecimal gfa,

        /** 占地面积（m²） */
        BigDecimal siteArea,

        @Size(max = 100, message = "region 长度不能超过 100")
        String region,

        @Pattern(regexp = "^[a-z]{2}(-[A-Z]{2})?$", message = "language 须符合 BCP 47 简写如 en")
        String language,

        /** V0 阶段集，未指定时服务层默认裁剪为 STG-P0/P1/P2/P5/P6/P7 */
        List<String> stages,

        /** 设置 JSONB */
        Map<String, Object> settings,

        /** 元数据 JSONB */
        Map<String, Object> metadata,

        /** 项目启动时间 */
        Instant startedAt,

        /** 目标完成时间 */
        Instant targetCompletionAt
) {
}
