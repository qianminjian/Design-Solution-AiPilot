package com.platform.core.iam.support;

import java.util.Optional;
import java.util.UUID;

/**
 * 租户上下文持有者
 * V1 阶段未集成认证，使用 ThreadLocal 兜底；
 * 后续接入认证后切换为从 SecurityContext 读取（D39 多租户）
 */
public final class TenantContextHolder {

    private static final ThreadLocal<UUID> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContextHolder() {
    }

    /**
     * 设置当前租户 ID
     */
    public static void setTenantId(UUID tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    /**
     * 获取当前租户 ID（可能为空）
     */
    public static Optional<UUID> getTenantId() {
        return Optional.ofNullable(CURRENT_TENANT.get());
    }

    /**
     * 清理当前租户 ID（防内存泄漏）
     */
    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
