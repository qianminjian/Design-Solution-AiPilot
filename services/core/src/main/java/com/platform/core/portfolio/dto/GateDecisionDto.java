package com.platform.core.portfolio.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 门禁决策响应 DTO（对齐 portfolio.contract.ts §GateDecisionDto）
 *
 * @param id            门禁决策 ID
 * @param tenantId      租户 ID
 * @param projectId     所属项目 ID
 * @param stageId       关联阶段 ID
 * @param gateCode      门禁编码
 * @param gateName      门禁名称
 * @param status        门禁状态
 * @param decision      决策结论
 * @param decidedAt     决策时间
 * @param decidedBy     决策人
 * @param baselineId    关联基线 ID（仅引用 PUBLISHED 状态基线）
 * @param comment       决策意见
 * @param classification 数据分类
 * @param evidence      证据 JSONB 数组（原始字符串）
 * @param metadata      元数据 JSONB（原始字符串）
 * @param createdAt     创建时间
 * @param updatedAt     更新时间
 * @param rowVersion    乐观锁版本号
 */
public record GateDecisionDto(
        UUID id,
        UUID tenantId,
        UUID projectId,
        UUID stageId,
        String gateCode,
        String gateName,
        String status,
        String decision,
        Instant decidedAt,
        UUID decidedBy,
        UUID baselineId,
        String comment,
        String classification,
        String evidence,
        String metadata,
        Instant createdAt,
        Instant updatedAt,
        Long rowVersion
) {
}
