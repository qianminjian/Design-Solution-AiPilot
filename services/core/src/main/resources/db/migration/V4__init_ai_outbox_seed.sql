-- V4__init_ai_outbox_seed.sql
-- ai 领域 + platform.outbox 事件发件箱 + 初始数据

-- ============================================================
-- 1. ai 领域 - AI 能力、运行、工具调用、护栏
-- ============================================================

-- 1.1 capability_revision - AI 能力定义修订
CREATE TABLE ai.capability_revision (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    stable_id UUID NOT NULL,
    revision_no BIGINT NOT NULL,
    capability_code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capability_type VARCHAR(100) NOT NULL DEFAULT 'LLM_CHAT',
    provider VARCHAR(100) NOT NULL,
    model VARCHAR(200) NOT NULL,
    risk_level VARCHAR(50) NOT NULL DEFAULT 'LOW',
    status revision_status NOT NULL DEFAULT 'DRAFT',
    prompt_template TEXT,
    default_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    guardrail_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_ai_cap_stable_revision
    ON ai.capability_revision(stable_id, revision_no);
CREATE UNIQUE INDEX idx_ai_cap_code
    ON ai.capability_revision(tenant_id, capability_code)
    WHERE status = 'PUBLISHED';
CREATE INDEX idx_ai_cap_type
    ON ai.capability_revision(tenant_id, capability_type)
    WHERE status = 'PUBLISHED';

COMMENT ON TABLE ai.capability_revision IS 'AI 能力定义修订（D34.5 ai 聚合根）';
COMMENT ON COLUMN ai.capability_revision.risk_level IS '风险等级：LOW/MEDIUM/HIGH/EXTREME（D0 安全红线 12）';

-- 1.2 ai_run - AI 运行记录
CREATE TABLE ai.run (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID REFERENCES portfolio.project(id) ON DELETE SET NULL,
    capability_id UUID REFERENCES ai.capability_revision(id),
    run_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost NUMERIC(20, 6) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    latency_ms INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_code VARCHAR(100),
    error_message TEXT,
    trace_id VARCHAR(255),
    human_review_required BOOLEAN NOT NULL DEFAULT FALSE,
    human_review_status VARCHAR(50),
    human_reviewed_by UUID REFERENCES iam.principal(id),
    human_reviewed_at TIMESTAMPTZ,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    input_summary TEXT,
    output_summary TEXT,
    input_manifest JSONB,
    output_manifest JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_ai_run_project ON ai.run(project_id, created_at DESC);
CREATE INDEX idx_ai_run_status ON ai.run(tenant_id, status, created_at DESC);
CREATE INDEX idx_ai_run_capability ON ai.run(capability_id, created_at DESC);
CREATE INDEX idx_ai_run_review ON ai.run(tenant_id, human_review_required, human_review_status)
    WHERE human_review_required = TRUE;

COMMENT ON TABLE ai.run IS 'AI 运行记录';
COMMENT ON COLUMN ai.run.human_review_required IS '是否需要人工复核（D0 AI 安全红线）';

-- 1.3 tool_call - 工具调用
CREATE TABLE ai.tool_call (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES ai.run(id) ON DELETE CASCADE,
    tool_name VARCHAR(200) NOT NULL,
    call_index INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    arguments JSONB,
    result JSONB,
    error_code VARCHAR(100),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    latency_ms INTEGER,
    classification data_classification NOT NULL DEFAULT 'OPERATIONAL_TELEMETRY',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_tool_call_run ON ai.tool_call(run_id, call_index);
CREATE INDEX idx_tool_call_status ON ai.tool_call(tenant_id, status);

COMMENT ON TABLE ai.tool_call IS 'AI 工具调用记录';

-- 1.4 guardrail_result - 护栏检查结果
CREATE TABLE ai.guardrail_result (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES ai.run(id) ON DELETE CASCADE,
    guardrail_type VARCHAR(100) NOT NULL,
    check_stage VARCHAR(50) NOT NULL,
    passed BOOLEAN NOT NULL DEFAULT TRUE,
    risk_score NUMERIC(5, 4),
    risk_level VARCHAR(50),
    findings JSONB NOT NULL DEFAULT '[]'::jsonb,
    action_taken VARCHAR(100) NOT NULL DEFAULT 'ALLOW',
    classification data_classification NOT NULL DEFAULT 'OPERATIONAL_TELEMETRY',
    details JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_guardrail_run ON ai.guardrail_result(run_id);
CREATE INDEX idx_guardrail_type ON ai.guardrail_result(tenant_id, guardrail_type, created_at DESC);
CREATE INDEX idx_guardrail_passed ON ai.guardrail_result(tenant_id, passed)
    WHERE passed = FALSE;

COMMENT ON TABLE ai.guardrail_result IS 'AI 护栏检查结果（D0 AI 安全）';

-- ============================================================
-- 2. platform 领域 - Outbox 事件发件箱
-- ============================================================

CREATE TABLE platform.outbox_event (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    project_id UUID,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    aggregate_version BIGINT NOT NULL,
    event_type VARCHAR(200) NOT NULL,
    schema_version VARCHAR(50) NOT NULL DEFAULT '1.0',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payload JSONB NOT NULL,
    trace_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    published_at TIMESTAMPTZ,
    publish_attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_retry_at TIMESTAMPTZ,
    classification data_classification NOT NULL DEFAULT 'OPERATIONAL_TELEMETRY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_status_publish ON platform.outbox_event(status, created_at)
    WHERE status = 'PENDING';
CREATE INDEX idx_outbox_aggregate ON platform.outbox_event(aggregate_type, aggregate_id, aggregate_version);
CREATE INDEX idx_outbox_tenant ON platform.outbox_event(tenant_id, created_at DESC);

COMMENT ON TABLE platform.outbox_event IS 'Outbox 事件发件箱（D34.11 Transactional Outbox 模式）';
COMMENT ON COLUMN platform.outbox_event.status IS 'PENDING/PUBLISHED/FAILED/DEAD_LETTER';

-- ============================================================
-- 3. 初始数据 - 系统租户 + 系统管理员
-- ============================================================

-- 系统租户
INSERT INTO iam.tenant (id, name, code, status, region, language, classification)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'System Tenant',
    'system',
    'ACTIVE',
    'us-east-1',
    'en',
    'PROJECT_RECORD'
) ON CONFLICT (id) DO NOTHING;

-- 系统组织
INSERT INTO iam.organization (id, tenant_id, name, type, status)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Platform Admin',
    'ORGANIZATION',
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- 系统管理员主体（密码：admin123，bcrypt 哈希）
INSERT INTO iam.principal (
    id, tenant_id, type, email, display_name, status,
    password_hash, locale, timezone, classification
)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'USER',
    'admin@platform.local',
    'Platform Admin',
    'ACTIVE',
    '$2a$12$R9h/cIPz0gyWvyI9Apf1O.zVq9zGkP9nN8nLz7kWnqQpJY5J8l8eS',
    'en',
    'UTC',
    'SENSITIVE'
) ON CONFLICT (id) DO NOTHING;

-- 管理员成员关系
INSERT INTO iam.membership (
    tenant_id, principal_id, organization_id, role, status
)
SELECT
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'ADMIN',
    'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1 FROM iam.membership
    WHERE principal_id = '00000000-0000-0000-0000-000000000003'
      AND organization_id = '00000000-0000-0000-0000-000000000002'
);

-- 管理员角色绑定（租户级别）
INSERT INTO iam.role_binding (
    tenant_id, principal_id, role_code, scope_type, scope_id, status, granted_by
)
SELECT
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',
    'PLATFORM_ADMIN',
    'TENANT',
    '00000000-0000-0000-0000-000000000001',
    'ACTIVE',
    '00000000-0000-0000-0000-000000000003'
WHERE NOT EXISTS (
    SELECT 1 FROM iam.role_binding
    WHERE principal_id = '00000000-0000-0000-0000-000000000003'
      AND role_code = 'PLATFORM_ADMIN'
      AND scope_type = 'TENANT'
);

-- ============================================================
-- 4. 为新增表创建 updated_at 触发器
-- ============================================================
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at'
          AND table_schema IN ('ai', 'platform')
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
