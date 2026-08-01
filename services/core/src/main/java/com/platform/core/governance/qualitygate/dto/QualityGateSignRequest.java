package com.platform.core.governance.qualitygate.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * 质量门禁签署请求（D45.23：每 Gate 签署角色落实，AI 不代签）
 */
public record QualityGateSignRequest(

        /** 签署角色（D45.23 每 Gate 签署角色，如 Developer+Reviewer / Release Authority） */
        @NotBlank(message = "signerRole is required")
        @Size(max = 100)
        String signerRole,

        /** 签署人（Principal ID） */
        @NotNull(message = "signedBy is required")
        UUID signedBy,

        /** 签署决定：PASS/FAIL */
        @NotBlank(message = "decision is required")
        @Pattern(regexp = "PASS|FAIL", message = "decision must be PASS or FAIL")
        String decision
) {
}
