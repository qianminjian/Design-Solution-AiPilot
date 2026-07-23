package com.platform.core.cde.support;

import com.platform.core.auth.security.AuthenticatedPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * 当前登录用户解析器
 * 从 SecurityContext 读取已认证主体 ID，用于填充 uploadedBy / checkedOutBy 等业务字段
 *
 * <p>V1 阶段 JpaAuditingConfig 的 auditorProvider 返回空（未集成认证审计），
 * 因此 CDE 域需要显式提取 principalId 用于业务字段（非审计字段）。
 * 后续 JpaAuditingConfig 接入认证后可移除此类。
 */
@Component
public class CurrentUserResolver {

    /**
     * 获取当前已认证主体 ID
     *
     * @return 主体 ID；未登录时返回 null（由调用方决定是否强制要求登录）
     */
    public UUID getCurrentPrincipalId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        Object principal = auth.getPrincipal();
        return principal instanceof AuthenticatedPrincipal ap ? ap.principalId() : null;
    }
}
