package com.platform.core.governance.accessgrant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * 访问授权操作请求（对齐 BFF zod governanceAccessGrantActionRequestSchema）
 *
 * 用于 approve/shorten/revoke 三种操作。
 * - shorten 必须提供 newExpiresAt
 * - 所有操作必须提供 reason
 * - 高风险操作必须提供 stepUpToken
 */
public record AccessGrantActionRequest(
        @NotNull Action action,

        @NotBlank
        @Size(min = 1, max = 500)
        String reason,

        /** 仅 action=shorten 时必填 */
        Instant newExpiresAt,

        /** 高风险操作时必填（service 端二次校验） */
        String stepUpToken
) {

    public enum Action {
        APPROVE,
        SHORTEN,
        REVOKE
    }
}
