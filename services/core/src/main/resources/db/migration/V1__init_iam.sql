-- V1__init_iam.sql
-- 施工图全流程 AI 平台 - V0 首切片数据库 Schema
-- 包含：扩展、Schema、通用枚举类型、iam 领域（身份与权限）

-- ============================================================
-- 1. 扩展
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. 领域 Schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS portfolio;
CREATE SCHEMA IF NOT EXISTS requirement;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS cde;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS platform;

-- ============================================================
-- 3. 通用枚举类型
-- ============================================================
-- V0 版本状态（D34.8.1 三态简化）
DO $$ BEGIN
    CREATE TYPE revision_status AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 数据分类（D34.17）
DO $$ BEGIN
    CREATE TYPE data_classification AS ENUM ('WORKING', 'PROJECT_RECORD', 'PUBLISHED_EVIDENCE', 'SENSITIVE', 'OPERATIONAL_TELEMETRY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 4. iam 领域 - 身份与权限
-- ============================================================

-- 4.1 tenant - 租户
CREATE TABLE iam.tenant (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    region VARCHAR(100) NOT NULL DEFAULT 'us-east-1',
    language VARCHAR(20) NOT NULL DEFAULT 'en',
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);

CREATE UNIQUE INDEX idx_tenant_code ON iam.tenant(code);
CREATE INDEX idx_tenant_status ON iam.tenant(status) WHERE deleted_at IS NULL;

COMMENT ON TABLE iam.tenant IS '租户表（D34.5 iam 聚合根）';
COMMENT ON COLUMN iam.tenant.id IS '租户 ID（UUIDv7）';
COMMENT ON COLUMN iam.tenant.code IS '租户编码，全局唯一';
COMMENT ON COLUMN iam.tenant.region IS '数据驻留 Region（OD-01）';

-- 4.2 organization - 组织
CREATE TABLE iam.organization (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'COMPANY',
    parent_id UUID REFERENCES iam.organization(id),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);

CREATE INDEX idx_org_tenant ON iam.organization(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_org_parent ON iam.organization(parent_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE iam.organization IS '组织表';

-- 4.3 principal - 主体（用户/服务账号/外部身份）
CREATE TABLE iam.principal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'USER',
    email VARCHAR(255),
    display_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    password_hash VARCHAR(255),
    locale VARCHAR(20) NOT NULL DEFAULT 'en',
    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
    classification data_classification NOT NULL DEFAULT 'SENSITIVE',
    external_id VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    row_version BIGINT NOT NULL DEFAULT 1,
    last_login_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);

CREATE UNIQUE INDEX idx_principal_tenant_email
    ON iam.principal(tenant_id, email)
    WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX idx_principal_tenant_status
    ON iam.principal(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_principal_external
    ON iam.principal(tenant_id, external_id)
    WHERE deleted_at IS NULL AND external_id IS NOT NULL;

COMMENT ON TABLE iam.principal IS '主体表（用户/服务账号）';
COMMENT ON COLUMN iam.principal.password_hash IS 'bcrypt/argon2id 密码哈希（PII: L1）';

-- 4.4 membership - 成员关系（用户-组织）
CREATE TABLE iam.membership (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES iam.principal(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES iam.organization(id) ON DELETE SET NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'MEMBER',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_membership_tenant_principal_org
    ON iam.membership(tenant_id, principal_id, organization_id)
    WHERE status = 'ACTIVE';
CREATE INDEX idx_membership_org ON iam.membership(tenant_id, organization_id);

COMMENT ON TABLE iam.membership IS '成员关系表';

-- 4.5 role_binding - 角色绑定（RBAC）
CREATE TABLE iam.role_binding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES iam.principal(id) ON DELETE CASCADE,
    role_code VARCHAR(100) NOT NULL,
    scope_type VARCHAR(50) NOT NULL DEFAULT 'TENANT',
    scope_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by UUID,
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_rb_principal ON iam.role_binding(tenant_id, principal_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_rb_scope ON iam.role_binding(tenant_id, scope_type, scope_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX idx_rb_unique
    ON iam.role_binding(tenant_id, principal_id, role_code, scope_type, scope_id)
    WHERE status = 'ACTIVE';

COMMENT ON TABLE iam.role_binding IS '角色绑定表（RBAC）';

-- 4.6 access_grant - 访问授权（细粒度）
CREATE TABLE iam.access_grant (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES iam.principal(id) ON DELETE CASCADE,
    permission VARCHAR(200) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    effect VARCHAR(20) NOT NULL DEFAULT 'ALLOW',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by UUID,
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_ag_principal ON iam.access_grant(tenant_id, principal_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_ag_resource ON iam.access_grant(tenant_id, resource_type, resource_id) WHERE status = 'ACTIVE';

COMMENT ON TABLE iam.access_grant IS '细粒度访问授权表';

-- ============================================================
-- 5. updated_at 自动更新触发器
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.row_version = OLD.row_version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有带 updated_at 的表创建触发器
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname IN ('iam', 'portfolio', 'requirement', 'workflow', 'cde', 'ai', 'platform')
          AND tablename IN (
            SELECT table_name FROM information_schema.columns
            WHERE column_name = 'updated_at' AND table_schema IN ('iam', 'portfolio', 'requirement', 'workflow', 'cde', 'ai', 'platform')
          )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_timestamp ON %I.%I',
            (SELECT table_schema FROM information_schema.columns
             WHERE table_name = t AND column_name = 'updated_at'
             LIMIT 1), t);
        EXECUTE format('CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON %I.%I
            FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp()',
            (SELECT table_schema FROM information_schema.columns
             WHERE table_name = t AND column_name = 'updated_at'
             LIMIT 1), t);
    END LOOP;
END $$;
