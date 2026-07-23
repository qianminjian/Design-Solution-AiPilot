package com.platform.core.auth.dto;

/**
 * Token 刷新响应
 * 对齐 packages/shared/src/contracts/auth.contract.ts §RefreshTokenResponse
 *
 * V1 简化：刷新时只返回新 access token，refresh token 不轮换
 * V2 改为 refresh token rotation（旧 token 失效，颁发新 refresh token）
 */
public record RefreshTokenResponse(
        String accessToken,
        long accessTokenExpiresIn,
        boolean refreshTokenSet
) {
}
