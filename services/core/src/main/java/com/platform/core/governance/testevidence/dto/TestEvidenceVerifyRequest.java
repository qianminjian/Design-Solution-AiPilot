package com.platform.core.governance.testevidence.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

/**
 * 测试证据校验请求（P0-1.4 验收：证据 hash 可校验）
 *
 * 调用方重新计算对象内容哈希后提交，服务端与存储的哈希比对。
 */
public record TestEvidenceVerifyRequest(

        /** 证据记录 ID */
        @NotNull(message = "evidenceId is required")
        UUID evidenceId,

        /** 实际内容哈希（SHA-256 hex） */
        @NotBlank(message = "actualHash is required")
        @Pattern(regexp = "^[a-f0-9]{64}$", message = "actualHash must be SHA-256 hex (64 chars)")
        String actualHash
) {
}
