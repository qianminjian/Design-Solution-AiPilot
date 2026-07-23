package com.platform.core.auth.dto;

/**
 * 登出请求
 * 对齐 packages/shared/src/contracts/auth.contract.ts §LogoutRequest
 *
 * refresh token 从 httpOnly Cookie 读取，不在请求体中传递
 */
public record LogoutRequest(
        /** 是否撤销所有设备的会话 */
        Boolean allDevices
) {
}
