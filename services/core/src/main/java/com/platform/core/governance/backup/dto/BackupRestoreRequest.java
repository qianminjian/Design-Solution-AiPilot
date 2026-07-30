package com.platform.core.governance.backup.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * 备份恢复请求（对齐 BFF zod governanceBackupRestoreRequestSchema）
 *
 * 恢复操作是高风险操作，必须提供 stepUpToken。
 * target=PRODUCTION 必须有更严格的审批流程（V1 简化：仅 stepUpToken 校验）。
 */
public record BackupRestoreRequest(
        @NotNull UUID backupId,

        @NotNull Target target,

        @NotBlank
        @Size(min = 1, max = 500)
        String reason,

        @NotBlank
        String stepUpToken
) {

    public enum Target {
        PRODUCTION,
        ISOLATED_ENV
    }
}
