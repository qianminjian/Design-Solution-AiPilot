package com.platform.core.auth.dto;

/**
 * 登出响应
 * 对齐 packages/shared/src/contracts/auth.contract.ts §LogoutResponse
 */
public record LogoutResponse(
        boolean revoked
) {
}
