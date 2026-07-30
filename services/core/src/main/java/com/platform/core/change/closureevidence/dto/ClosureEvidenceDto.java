package com.platform.core.change.closureevidence.dto;

import com.platform.core.change.domain.enums.ClosureEvidenceStatus;
import com.platform.core.change.domain.enums.ClosureEvidenceType;

import java.time.Instant;
import java.util.UUID;

/**
 * 关闭证据 DTO（对齐 BFF zod closureEvidenceSchema）
 *
 * 用于 API 响应，所有字段与前端 TypeScript 类型保持一致。
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record ClosureEvidenceDto(
        UUID id,
        UUID changeId,
        ClosureEvidenceType type,
        String title,
        String sourceId,
        String sourceDescription,
        ClosureEvidenceStatus status,
        String verifiedBy,
        Instant verifiedAt,
        String verificationNote,
        String summary,
        String evidenceUrl,
        boolean blocksClosure,
        String submittedBy,
        Instant submittedAt,
        String reviewer1,
        String reviewer2,
        Instant createdAt,
        Instant updatedAt
) {
}
