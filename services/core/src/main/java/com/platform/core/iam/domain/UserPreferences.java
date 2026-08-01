package com.platform.core.iam.domain;

import com.platform.core.common.entity.TenantBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/**
 * 用户偏好设置实体（一对一关联 Principal）
 *
 * 不包含 locale/timezone（已存在 Principal 中作为核心身份字段）；
 * 仅存储 UI 偏好与通知开关，所有字段仅影响 UI 提示强度，不影响业务流程。
 *
 * 安全红线（security.md §12 与 design-constraints.md）：
 *  - showAiSafetyBanner / requireHumanReviewBadge 仅影响 UI 提示强度
 *  - 即使关闭 Banner，AI 输出仍标记为"AI 辅助"，高风险结果仍进入人工复核
 */
@Entity
@Table(name = "user_preferences", schema = "iam")
public class UserPreferences extends TenantBaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** 关联主体 ID（一对一） */
    @Column(name = "principal_id", nullable = false, updatable = false, unique = true)
    private UUID principalId;

    /** 单位制：metric / imperial */
    @Column(name = "unit_system", nullable = false)
    private String unitSystem = "metric";

    /** 币种代码：CNY / USD / EUR 等 */
    @Column(name = "currency", nullable = false)
    private String currency = "CNY";

    /** 主题模式：light / dark / system */
    @Column(name = "theme", nullable = false)
    private String theme = "light";

    /** 邮件通知 */
    @Column(name = "email_notify", nullable = false)
    private Boolean emailNotify = Boolean.TRUE;

    /** 应用内通知 */
    @Column(name = "in_app_notify", nullable = false)
    private Boolean inAppNotify = Boolean.TRUE;

    /** 每日摘要 */
    @Column(name = "daily_digest", nullable = false)
    private Boolean dailyDigest = Boolean.FALSE;

    /** @提及通知 */
    @Column(name = "mention_notify", nullable = false)
    private Boolean mentionNotify = Boolean.TRUE;

    /** 显示 AI 安全 Banner（仅影响 UI） */
    @Column(name = "show_ai_safety_banner", nullable = false)
    private Boolean showAiSafetyBanner = Boolean.TRUE;

    /** 高亮显示人工复核徽章（仅影响 UI） */
    @Column(name = "require_human_review_badge", nullable = false)
    private Boolean requireHumanReviewBadge = Boolean.TRUE;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getPrincipalId() {
        return principalId;
    }

    public void setPrincipalId(UUID principalId) {
        this.principalId = principalId;
    }

    public String getUnitSystem() {
        return unitSystem;
    }

    public void setUnitSystem(String unitSystem) {
        this.unitSystem = unitSystem;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getTheme() {
        return theme;
    }

    public void setTheme(String theme) {
        this.theme = theme;
    }

    public Boolean getEmailNotify() {
        return emailNotify;
    }

    public void setEmailNotify(Boolean emailNotify) {
        this.emailNotify = emailNotify;
    }

    public Boolean getInAppNotify() {
        return inAppNotify;
    }

    public void setInAppNotify(Boolean inAppNotify) {
        this.inAppNotify = inAppNotify;
    }

    public Boolean getDailyDigest() {
        return dailyDigest;
    }

    public void setDailyDigest(Boolean dailyDigest) {
        this.dailyDigest = dailyDigest;
    }

    public Boolean getMentionNotify() {
        return mentionNotify;
    }

    public void setMentionNotify(Boolean mentionNotify) {
        this.mentionNotify = mentionNotify;
    }

    public Boolean getShowAiSafetyBanner() {
        return showAiSafetyBanner;
    }

    public void setShowAiSafetyBanner(Boolean showAiSafetyBanner) {
        this.showAiSafetyBanner = showAiSafetyBanner;
    }

    public Boolean getRequireHumanReviewBadge() {
        return requireHumanReviewBadge;
    }

    public void setRequireHumanReviewBadge(Boolean requireHumanReviewBadge) {
        this.requireHumanReviewBadge = requireHumanReviewBadge;
    }
}
