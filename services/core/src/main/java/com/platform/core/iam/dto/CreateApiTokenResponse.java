package com.platform.core.iam.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 创建 API Token 响应
 *
 * <p>安全约束：包含 plainToken 字段，仅在创建时返回一次。
 * 前端必须立即复制保存，关闭对话框后无法再次获取。
 */
public record CreateApiTokenResponse(
        UUID id,
        UUID principalId,
        String name,
        String prefix,
        /** 完整明文 token（仅本次响应返回，之后不可获取） */
        String plainToken,
        List<String> scopes,
        String status,
        Instant expiresAt,
        Instant createdAt
) {
}
