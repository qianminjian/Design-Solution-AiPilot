package com.platform.core.governance.testevidence.dto;

import java.util.UUID;

/**
 * 测试证据校验结果（P0-1.4 验收：证据 hash 可校验）
 */
public record TestEvidenceVerifyResult(
        UUID evidenceId,
        boolean verified,
        String storedHash,
        String actualHash
) {
}
