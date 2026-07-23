package com.platform.core.portfolio.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 阶段实例响应 DTO（对齐 portfolio.contract.ts §StageInstanceDto）
 *
 * @param id            阶段实例 ID
 * @param tenantId      租户 ID
 * @param projectId     所属项目 ID
 * @param stageCode     阶段编码
 * @param stageName     阶段名称
 * @param stageOrder    阶段顺序
 * @param status        阶段状态
 * @param startedAt     启动时间
 * @param completedAt   完成时间
 * @param classification 数据分类
 * @param metadata      元数据 JSONB（原始字符串）
 * @param createdAt     创建时间
 * @param updatedAt     更新时间
 * @param rowVersion    乐观锁版本号
 */
public record StageInstanceDto(
        UUID id,
        UUID tenantId,
        UUID projectId,
        String stageCode,
        String stageName,
        Integer stageOrder,
        String status,
        Instant startedAt,
        Instant completedAt,
        String classification,
        String metadata,
        Instant createdAt,
        Instant updatedAt,
        Long rowVersion
) {
}
