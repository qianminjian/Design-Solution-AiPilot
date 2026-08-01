-- ============================================================
-- V23: 用户偏好设置表（UserPreferences API V1）
-- 对齐 D37 §关键界面-交互状态：偏好设置持久化
-- 关联 A-62 审计修复后续 V1 接入
-- ============================================================

-- 1. user_preferences 表（一对一关联 iam.principal）
CREATE TABLE iam.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES iam.principal(id) ON DELETE CASCADE,

    -- 区域与单位
    unit_system VARCHAR(20) NOT NULL DEFAULT 'metric',
    currency VARCHAR(10) NOT NULL DEFAULT 'CNY',

    -- 外观
    theme VARCHAR(20) NOT NULL DEFAULT 'light',

    -- 通知偏好
    email_notify BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_notify BOOLEAN NOT NULL DEFAULT TRUE,
    daily_digest BOOLEAN NOT NULL DEFAULT FALSE,
    mention_notify BOOLEAN NOT NULL DEFAULT TRUE,

    -- AI 安全与可见性偏好（仅影响 UI 提示强度，不影响业务流程）
    show_ai_safety_banner BOOLEAN NOT NULL DEFAULT TRUE,
    require_human_review_badge BOOLEAN NOT NULL DEFAULT TRUE,

    -- 审计字段
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    row_version BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT uk_user_preferences_principal UNIQUE (principal_id)
);

-- 索引：按租户查询偏好列表（管理员视角）
CREATE INDEX idx_user_preferences_tenant
    ON iam.user_preferences(tenant_id);

COMMENT ON TABLE iam.user_preferences IS '用户偏好设置表（一对一关联 principal，V1 接入）';
COMMENT ON COLUMN iam.user_preferences.unit_system IS '单位制：metric / imperial';
COMMENT ON COLUMN iam.user_preferences.currency IS '币种代码：CNY / USD / EUR 等';
COMMENT ON COLUMN iam.user_preferences.theme IS '主题模式：light / dark / system';
COMMENT ON COLUMN iam.user_preferences.show_ai_safety_banner IS 'AI 安全 Banner 显示开关（仅影响 UI，不影响业务流程）';
COMMENT ON COLUMN iam.user_preferences.require_human_review_badge IS '人工复核徽章显示开关（仅影响 UI，不影响业务流程）';
