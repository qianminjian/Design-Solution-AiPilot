package com.platform.core.governance.restore.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

/**
 * 灾备演练创建请求（对齐 BFF zod governanceRestoreDrillCreateRequestSchema）
 *
 * 演练操作必须提供 stepUpToken（高风险）。
 */
public record RestoreDrillCreateRequest(
        @NotNull UUID backupId,

        @NotNull Target target,

        @NotBlank
        @Size(max = 200)
        String operator,

        /** 计划开始时间（可空，默认立即开始） */
        Instant scheduledAt,

        @NotBlank
        String stepUpToken
) {

    public enum Target {
        ISOLATED_ENV,
        PRODUCTION
    }
}
