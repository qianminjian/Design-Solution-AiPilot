package com.platform.core.portfolio.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 项目基线响应 DTO（对齐 portfolio.contract.ts §ProjectBaselineDto）
 *
 * @param id            基线 ID
 * @param tenantId      租户 ID
 * @param projectId     所属项目 ID
 * @param revisionNo    修订号（项目内单调递增）
 * @param name          基线名称
 * @param status        修订状态（DRAFT / PUBLISHED / SUPERSEDED，PUBLISHED 即冻结可被引用）
 * @param frozenAt      冻结时间
 * @param frozenBy      冻结执行人
 * @param description   描述
 * @param classification 数据分类
 * @param metadata      元数据 JSONB（原始字符串）
 * @param createdAt     创建时间
 * @param updatedAt     更新时间
 * @param rowVersion    乐观锁版本号
 */
public record ProjectBaselineDto(
        UUID id,
        UUID tenantId,
        UUID projectId,
        Long revisionNo,
        String name,
        String status,
        Instant frozenAt,
        UUID frozenBy,
        String description,
        String classification,
        String metadata,
        Instant createdAt,
        Instant updatedAt,
        Long rowVersion
) {
}
