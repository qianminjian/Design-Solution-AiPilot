-- ============================================================
-- V24: IAM API Token 表（V1 IAM Token API 接入）
-- 对齐 design/D39-身份多租户-授权.md + security.md §1 密钥管理
-- 关联 A-63 IAM Token API V1 实现
--
-- 安全约束（security.md §1）：
--  - token_hash 仅存 SHA-256 + 盐哈希（防彩虹表），不存明文
--  - 明文 token 仅在创建时返回一次，之后不可再获取
--  - 撤销操作不可逆，仅更新 status，不物理删除（保留审计追溯）
--  - 强制 ≤ 90 天过期，过期未使用自动转为 expired
-- ============================================================

-- 1. iam.api_tokens 表（一对多关联 iam.principal）
CREATE TABLE iam.api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES iam.principal(id) ON DELETE CASCADE,

    -- Token 名称（用户可读，租户+主体范围内唯一）
    name VARCHAR(100) NOT NULL,

    -- 前缀（创建时生成，仅展示前 12 位用于识别，明文存储）
    prefix VARCHAR(12) NOT NULL,

    -- 哈希后的 token（SHA-256 + 盐，存储为十六进制字符串）
    token_hash VARCHAR(128) NOT NULL,

    -- 盐值（每个 token 独立盐，防止彩虹表）
    token_salt VARCHAR(64) NOT NULL,

    -- 权限范围（JSON 数组，遵循最小权限原则）
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- 状态：active / expired / revoked
    status VARCHAR(20) NOT NULL DEFAULT 'active',

    -- 过期时间（强制 ≤ 90 天）
    expires_at TIMESTAMPTZ NOT NULL,

    -- 最后使用时间（首次使用后填充）
    last_used_at TIMESTAMPTZ,

    -- 撤销信息
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(255),

    -- 审计字段
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    row_version BIGINT NOT NULL DEFAULT 1
);

-- 索引：按租户+主体查询 Token 列表
CREATE INDEX idx_api_tokens_tenant_principal
    ON iam.api_tokens(tenant_id, principal_id)
    WHERE status = 'active';

-- 索引：按 token_hash 查询（认证时使用）
CREATE INDEX idx_api_tokens_hash
    ON iam.api_tokens(token_hash)
    WHERE status = 'active';

-- 唯一约束：同主体下 Token 名称不重复（仅 active 状态）
CREATE UNIQUE INDEX uk_api_tokens_principal_name
    ON iam.api_tokens(tenant_id, principal_id, name)
    WHERE status = 'active';

COMMENT ON TABLE iam.api_tokens IS 'IAM API Token 表（个人访问令牌，V1 接入）';
COMMENT ON COLUMN iam.api_tokens.prefix IS 'Token 明文前 12 位（用于识别展示，不影响安全性）';
COMMENT ON COLUMN iam.api_tokens.token_hash IS 'SHA-256 + 盐哈希后的 token（PII: L1，禁止明文存储）';
COMMENT ON COLUMN iam.api_tokens.token_salt IS 'Token 独立盐值（每个 token 不同，防止彩虹表攻击）';
COMMENT ON COLUMN iam.api_tokens.scopes IS '权限范围 JSON 数组（如 ["read:projects","write:documents"]，遵循最小权限原则）';
COMMENT ON COLUMN iam.api_tokens.status IS 'Token 状态：active（生效中）/ expired（已过期）/ revoked（已撤销）';
COMMENT ON COLUMN iam.api_tokens.expires_at IS '过期时间（强制 ≤ 90 天，security.md §1 JWT access token ≤ 15min 不适用于 PAT，PAT 允许 ≤ 90 天）';
COMMENT ON COLUMN iam.api_tokens.last_used_at IS '最后使用时间（认证成功时更新，用于检测异常使用模式）';
COMMENT ON COLUMN iam.api_tokens.revoked_at IS '撤销时间（仅 status=revoked 时填充，撤销不可逆）';
