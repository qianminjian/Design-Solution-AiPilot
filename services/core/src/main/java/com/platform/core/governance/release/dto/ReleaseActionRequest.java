package com.platform.core.governance.release.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Release 操作请求（对齐 BFF zod governanceReleaseActionRequestSchema）
 *
 * 五种操作：
 *  - CANARY：进入灰度（需提供 canaryPercent）
 *  - PROMOTE：灰度转全量
 *  - ROLLBACK：紧急回滚
 *  - APPROVE：审批通过（REVIEW → CANARY）
 *  - DEPRECATE：弃用
 */
public record ReleaseActionRequest(
        @NotNull Action action,

        @NotBlank
        @Size(min = 1, max = 500)
        String reason,

        /** 仅 action=CANARY 时必填 */
        @Min(0)
        @Max(100)
        Integer canaryPercent,

        /** 高风险操作时必填（PROMOTE / ROLLBACK / DEPRECATE） */
        String stepUpToken
) {

    public enum Action {
        CANARY,
        PROMOTE,
        ROLLBACK,
        APPROVE,
        DEPRECATE
    }
}
