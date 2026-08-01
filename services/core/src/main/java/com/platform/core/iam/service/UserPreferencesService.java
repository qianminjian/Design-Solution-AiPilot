package com.platform.core.iam.service;

import com.platform.core.common.security.AuthenticatedPrincipal;
import com.platform.core.iam.domain.UserPreferences;
import com.platform.core.iam.dto.UpdateUserPreferencesRequest;
import com.platform.core.iam.dto.UserPreferencesDto;
import com.platform.core.iam.repository.UserPreferencesRepository;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 用户偏好设置应用服务
 *
 * 设计：
 *  - GET：若数据库无记录，返回内存默认值（不持久化），避免在 Principal 创建时耦合写入
 *  - PUT：upsert 模式，存在则更新，不存在则创建
 *
 * 安全红线（security.md §1）：
 *  - 不读取 x-user-id 请求头（防客户端伪造）
 *  - principalId 仅从 SecurityContext 的 AuthenticatedPrincipal 获取
 */
@Service
public class UserPreferencesService {

    private static final Logger log = LoggerFactory.getLogger(UserPreferencesService.class);

    private final UserPreferencesRepository repository;

    public UserPreferencesService(UserPreferencesRepository repository) {
        this.repository = repository;
    }

    /**
     * 获取当前用户的偏好设置
     * 若数据库无记录，返回内存默认值（不持久化）
     */
    @Transactional(readOnly = true)
    public UserPreferencesDto getMyPreferences() {
        AuthenticatedPrincipal auth = currentPrincipalOrThrow();
        return repository.findByPrincipalId(auth.principalId())
                .map(this::toDto)
                .orElseGet(() -> defaultDto(auth.principalId(), auth.tenantId()));
    }

    /**
     * 更新（或创建）当前用户的偏好设置
     */
    @Transactional
    public UserPreferencesDto updateMyPreferences(UpdateUserPreferencesRequest request) {
        AuthenticatedPrincipal auth = currentPrincipalOrThrow();
        UserPreferences entity = repository.findByPrincipalId(auth.principalId())
                .orElseGet(() -> createNew(auth.principalId(), auth.tenantId()));

        applyRequest(entity, request);
        UserPreferences saved = repository.save(entity);
        log.info("更新用户偏好成功 principalId={} theme={}", auth.principalId(), saved.getTheme());
        return toDto(saved);
    }

    private AuthenticatedPrincipal currentPrincipalOrThrow() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("未找到认证上下文，无法解析当前主体");
        }
        Object principal = authentication.getPrincipal();
        if (!(principal instanceof AuthenticatedPrincipal authenticated)) {
            throw new IllegalStateException(
                    "认证主体类型不匹配，期望 AuthenticatedPrincipal 实际: "
                            + (principal != null ? principal.getClass().getName() : "null"));
        }
        return authenticated;
    }

    private UserPreferences createNew(UUID principalId, UUID tenantId) {
        UserPreferences entity = new UserPreferences();
        entity.setPrincipalId(principalId);
        entity.setTenantId(tenantId);
        return entity;
    }

    private void applyRequest(UserPreferences entity, UpdateUserPreferencesRequest request) {
        entity.setUnitSystem(request.unitSystem());
        entity.setCurrency(request.currency());
        entity.setTheme(request.theme());
        entity.setEmailNotify(request.emailNotify());
        entity.setInAppNotify(request.inAppNotify());
        entity.setDailyDigest(request.dailyDigest());
        entity.setMentionNotify(request.mentionNotify());
        entity.setShowAiSafetyBanner(request.showAiSafetyBanner());
        entity.setRequireHumanReviewBadge(request.requireHumanReviewBadge());
    }

    private UserPreferencesDto toDto(UserPreferences entity) {
        return new UserPreferencesDto(
                entity.getId(),
                entity.getPrincipalId(),
                entity.getUnitSystem(),
                entity.getCurrency(),
                entity.getTheme(),
                entity.getEmailNotify(),
                entity.getInAppNotify(),
                entity.getDailyDigest(),
                entity.getMentionNotify(),
                entity.getShowAiSafetyBanner(),
                entity.getRequireHumanReviewBadge(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getRowVersion()
        );
    }

    private UserPreferencesDto defaultDto(UUID principalId, UUID tenantId) {
        // 内存默认值（不持久化）：与 UserPreferences 实体字段默认值一致
        UserPreferences defaults = new UserPreferences();
        defaults.setPrincipalId(principalId);
        defaults.setTenantId(tenantId);
        return toDto(defaults);
    }
}
