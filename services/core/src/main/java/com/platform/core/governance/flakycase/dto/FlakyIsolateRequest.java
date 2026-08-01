package com.platform.core.governance.flakycase.dto;

import jakarta.validation.constraints.Size;

/**
 * Flaky Case 隔离请求（D45.22：对应 Requirement 变 Coverage Gap）
 */
public record FlakyIsolateRequest(

        /** 替代确定性 TestCase ID（提供则不阻断发布） */
        @Size(max = 200)
        String replacementCaseId
) {
}
