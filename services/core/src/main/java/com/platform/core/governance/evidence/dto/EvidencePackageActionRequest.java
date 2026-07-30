package com.platform.core.governance.evidence.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 证据包操作请求（对齐 BFF zod governanceEvidencePackageActionRequestSchema）
 *
 * 四种操作：
 *  - SEAL：封存（DRAFT → SEALED，需 verifier）
 *  - VERIFY：验证（SEALED → VERIFIED，需 verifier + signature）
 *  - EXPORT：导出（生成下载 URL）
 *  - CHALLENGE：质疑（触发复核）
 */
public record EvidencePackageActionRequest(
        @NotNull Action action,

        /** SEAL/CHALLENGE 时可空；VERIFY/EXPORT 时必填 */
        @Size(max = 500)
        String reason,

        /** 操作者（SEAL/VERIFY 必填） */
        String verifier,

        /** VERIFY 时必填（数字签章） */
        String signature,

        /** 高风险操作（SEAL/VERIFY）必须提供 */
        String stepUpToken
) {

    public enum Action {
        SEAL,
        VERIFY,
        EXPORT,
        CHALLENGE
    }
}
