package com.platform.core.change.closureevidence.dto;

import jakarta.validation.constraints.Size;

/**
 * 验证关闭证据请求（D37.16 P12）
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
public record VerifyClosureEvidenceRequest(
        /** 验证结果：VERIFIED / REJECTED */
        String verificationResult,

        @Size(max = 2000)
        String verificationNote,

        /** 复核人 2（高风险证据双人复核时必填） */
        @Size(max = 200)
        String reviewer2
) {
}
