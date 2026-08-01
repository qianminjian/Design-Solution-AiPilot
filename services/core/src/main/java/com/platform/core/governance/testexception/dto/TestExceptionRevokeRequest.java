package com.platform.core.governance.testexception.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 测试例外撤销请求（D45.25：POST /test-exceptions/{id}:revoke）
 */
public record TestExceptionRevokeRequest(

        /** 撤销原因（脱敏） */
        @NotBlank(message = "reason is required")
        @Size(max = 2000)
        String reason
) {
}
