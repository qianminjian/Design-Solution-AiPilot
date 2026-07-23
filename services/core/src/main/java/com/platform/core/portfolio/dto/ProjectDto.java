package com.platform.core.portfolio.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * 项目响应 DTO（对齐 portfolio.contract.ts §ProjectDto）
 *
 * @param id                  项目 ID
 * @param tenantId            租户 ID
 * @param organizationId      所属组织 ID
 * @param code                项目编码（租户内唯一）
 * @param name                项目名称
 * @param description         描述
 * @param status              项目状态
 * @param buildingType        建筑类型
 * @param floorsMin           最小层数
 * @param floorsMax           最大层数
 * @param gfa                 总建筑面积 GFA
 * @param siteArea            占地面积
 * @param region              数据驻留 Region
 * @param language            项目语言
 * @param classification      数据分类
 * @param settings            设置 JSONB（原始字符串）
 * @param metadata            元数据 JSONB（原始字符串）
 * @param startedAt           启动时间
 * @param targetCompletionAt  目标完成时间
 * @param createdAt           创建时间
 * @param updatedAt           更新时间
 * @param createdBy           创建人
 * @param updatedBy           更新人
 * @param rowVersion          乐观锁版本号
 */
public record ProjectDto(
        UUID id,
        UUID tenantId,
        UUID organizationId,
        String code,
        String name,
        String description,
        String status,
        String buildingType,
        Integer floorsMin,
        Integer floorsMax,
        BigDecimal gfa,
        BigDecimal siteArea,
        String region,
        String language,
        String classification,
        String settings,
        String metadata,
        Instant startedAt,
        Instant targetCompletionAt,
        Instant createdAt,
        Instant updatedAt,
        UUID createdBy,
        UUID updatedBy,
        Long rowVersion
) {
}
