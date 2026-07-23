package com.platform.core.auth.token;

import java.time.Instant;
import java.util.UUID;

/**
 * Refresh Token 存储抽象
 *
 * V1 使用 InMemoryRefreshTokenStore（ConcurrentHashMap）
 * V2 替换为 Redis 实现以支持多实例共享
 *
 * 安全约束：
 * - token 值不打印到日志
 * - 支持 rotation（撤销旧 token 后颁发新 token）
 * - 支持按 principal 撤销所有会话（allDevices 登出）
 */
public interface RefreshTokenStore {

    /**
     * 存储 refresh token
     *
     * @param token       refresh token 字符串
     * @param principalId 主体 ID
     * @param expiresAt   过期时间
     */
    void store(String token, UUID principalId, Instant expiresAt);

    /**
     * 校验 refresh token 是否有效（存在且未过期、未撤销）
     */
    boolean validate(String token);

    /**
     * 从 token 提取 principalId
     * 不存在时返回 null
     */
    UUID getPrincipalId(String token);

    /**
     * 撤销单个 refresh token（rotation / 单点登出）
     */
    void revoke(String token);

    /**
     * 撤销某主体的所有 refresh token（allDevices 登出）
     */
    void revokeAllForPrincipal(UUID principalId);
}
