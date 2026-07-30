package com.platform.core.change.affecteditem.dto;

import com.platform.core.change.domain.enums.AffectedAction;
import com.platform.core.change.domain.enums.AffectedObjectType;
import com.platform.core.change.domain.enums.ImpactLevel;
import com.platform.core.change.domain.enums.RecheckStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * 受影响项 DTO（对齐 BFF zod affectedItemSchema）
 *
 * 用于 API 响应，所有字段与前端 TypeScript 类型保持一致。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record AffectedItemDto(
        UUID id,
        UUID changeId,
        AffectedObjectType type,
        String code,
        String name,
        String discipline,
        AffectedAction action,
        ImpactLevel impact,
        boolean recheckRequired,
        RecheckStatus recheckStatus,
        String owner,
        String evidence,
        String sourceBaselineId,
        String watermark,
        String objectRefId,
        Instant recheckedAt,
        String recheckedBy,
        Instant createdAt,
        Instant updatedAt
) {
}
