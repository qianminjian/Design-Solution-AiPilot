package com.platform.core.governance.backup.dto;

import com.platform.core.governance.domain.enums.GovernanceBackupScope;
import com.platform.core.governance.domain.enums.GovernanceBackupType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 备份创建请求（对齐 BFF zod governanceBackupCreateRequestSchema）
 */
public record BackupCreateRequest(
        @NotNull GovernanceBackupType type,

        @NotNull GovernanceBackupScope scope,

        @NotBlank
        @Size(min = 1, max = 500)
        String reason,

        String stepUpToken
) {
}
