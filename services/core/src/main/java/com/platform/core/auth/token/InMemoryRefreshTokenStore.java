package com.platform.core.auth.token;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 基于内存的 Refresh Token 存储
 *
 * V1 简化实现：
 * - 使用 ConcurrentHashMap 保证线程安全
 * - 单实例可见，重启后所有会话失效（用户需重新登录）
 * - V2 替换为 Redis 实现后删除本类
 *
 * 注意：本实现不主动清理过期 token，依赖 maxAge 自然过期
 * 生产环境使用 Redis 时由 Redis TTL 自动清理
 */
@Component
public class InMemoryRefreshTokenStore implements RefreshTokenStore {

    private static final Logger log = LoggerFactory.getLogger(InMemoryRefreshTokenStore.class);

    /** token → 会话信息 */
    private final Map<String, TokenEntry> store = new ConcurrentHashMap<>();

    /** 主体 ID → 该主体的所有 token（用于 allDevices 登出） */
    private final Map<UUID, java.util.Set<String>> principalTokens = new ConcurrentHashMap<>();

    @Override
    public void store(String token, UUID principalId, Instant expiresAt) {
        if (token == null || principalId == null || expiresAt == null) {
            throw new IllegalArgumentException("token / principalId / expiresAt 不能为空");
        }
        store.put(token, new TokenEntry(principalId, expiresAt));
        principalTokens.computeIfAbsent(principalId, k -> ConcurrentHashMap.newKeySet())
                .add(token);
        log.debug("存储 refresh token principalId={} expiresAt={}", principalId, expiresAt);
    }

    @Override
    public boolean validate(String token) {
        if (token == null) {
            return false;
        }
        TokenEntry entry = store.get(token);
        if (entry == null) {
            return false;
        }
        if (entry.expiresAt().isBefore(Instant.now())) {
            // 惰性清理过期 token
            remove(token, entry);
            return false;
        }
        return true;
    }

    @Override
    public UUID getPrincipalId(String token) {
        if (token == null) {
            return null;
        }
        TokenEntry entry = store.get(token);
        if (entry == null) {
            return null;
        }
        if (entry.expiresAt().isBefore(Instant.now())) {
            remove(token, entry);
            return null;
        }
        return entry.principalId();
    }

    @Override
    public void revoke(String token) {
        if (token == null) {
            return;
        }
        TokenEntry entry = store.remove(token);
        if (entry != null) {
            java.util.Set<String> tokens = principalTokens.get(entry.principalId());
            if (tokens != null) {
                tokens.remove(token);
            }
            log.debug("撤销 refresh token principalId={}", entry.principalId());
        }
    }

    @Override
    public void revokeAllForPrincipal(UUID principalId) {
        if (principalId == null) {
            return;
        }
        java.util.Set<String> tokens = principalTokens.remove(principalId);
        if (tokens == null || tokens.isEmpty()) {
            return;
        }
        for (String token : tokens) {
            store.remove(token);
        }
        log.info("撤销主体所有 refresh token principalId={} count={}", principalId, tokens.size());
    }

    private void remove(String token, TokenEntry entry) {
        store.remove(token);
        java.util.Set<String> tokens = principalTokens.get(entry.principalId());
        if (tokens != null) {
            tokens.remove(token);
        }
    }

    /** Token 存储条目 */
    private record TokenEntry(UUID principalId, Instant expiresAt) {
    }
}
