package com.platform.core.governance.accessgrant.dto;

import com.platform.core.governance.domain.enums.GovernanceAccessGrantStatus;
import com.platform.core.governance.domain.enums.GovernanceAccessGrantType;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 治理域访问授权 DTO（对齐 BFF zod governanceAccessGrantSchema）
 *
 * 用于 API 响应，所有字段与前端 TypeScript 类型保持一致。
 * 字段命名采用 camelCase，由 Jackson 自动序列化为 JSON。
 */
public record AccessGrantDto(
        UUID id,
        GovernanceAccessGrantType type,
        String principalName,
        String principalEmail,
        String resource,
        String permission,
        GovernanceRiskLevel riskLevel,
        GovernanceAccessGrantStatus status,
        String grantedBy,
        Instant grantedAt,
        Instant expiresAt,
        Instant lastUsedAt,
        String owner,
        String ownerEmail,
        String reason,
        boolean requiresStepUp,
        boolean hasLegalHold,
        List<String> propagationDependents
) {
}
