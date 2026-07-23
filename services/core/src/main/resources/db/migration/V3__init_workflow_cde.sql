-- V3__init_workflow_cde.sql
-- workflow（工作流） + cde（资产与版本）领域

-- ============================================================
-- 1. workflow 领域 - 工作流、任务、状态机
-- ============================================================

-- 1.1 workflow_definition_revision - 工作流定义修订
CREATE TABLE workflow.definition_revision (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    stable_id UUID NOT NULL,
    revision_no BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    definition_type VARCHAR(100) NOT NULL DEFAULT 'STATE_MACHINE',
    definition JSONB NOT NULL,
    status revision_status NOT NULL DEFAULT 'DRAFT',
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_wf_def_stable_revision
    ON workflow.definition_revision(stable_id, revision_no);
CREATE INDEX idx_wf_def_status
    ON workflow.definition_revision(tenant_id, status);

COMMENT ON TABLE workflow.definition_revision IS '工作流定义修订';

-- 1.2 workflow_instance - 工作流实例
CREATE TABLE workflow.instance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID REFERENCES portfolio.project(id) ON DELETE SET NULL,
    definition_id UUID NOT NULL REFERENCES workflow.definition_revision(id),
    business_key VARCHAR(255),
    current_state VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'RUNNING',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_wf_inst_project ON workflow.instance(project_id, created_at DESC);
CREATE INDEX idx_wf_inst_status ON workflow.instance(tenant_id, status);
CREATE UNIQUE INDEX idx_wf_inst_business_key
    ON workflow.instance(tenant_id, definition_id, business_key)
    WHERE business_key IS NOT NULL;

COMMENT ON TABLE workflow.instance IS '工作流实例';

-- 1.3 task - 任务
CREATE TABLE workflow.task (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID REFERENCES portfolio.project(id) ON DELETE SET NULL,
    workflow_instance_id UUID REFERENCES workflow.instance(id) ON DELETE SET NULL,
    task_type VARCHAR(100) NOT NULL DEFAULT 'HUMAN',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    assignee_id UUID REFERENCES iam.principal(id),
    candidate_group VARCHAR(255),
    due_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    task_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_task_assignee ON workflow.task(tenant_id, assignee_id, status, due_at)
    WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_task_project ON workflow.task(project_id, status, created_at DESC);
CREATE INDEX idx_task_status ON workflow.task(tenant_id, status);
CREATE INDEX idx_task_due ON workflow.task(tenant_id, due_at)
    WHERE status IN ('PENDING', 'IN_PROGRESS');

COMMENT ON TABLE workflow.task IS '任务表（人工/系统任务）';

-- 1.4 task_attempt - 任务执行尝试
CREATE TABLE workflow.attempt (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES workflow.task(id) ON DELETE CASCADE,
    attempt_no INTEGER NOT NULL DEFAULT 1,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'RUNNING',
    result TEXT,
    error_code VARCHAR(100),
    error_message TEXT,
    worker_id VARCHAR(255),
    duration_ms BIGINT,
    classification data_classification NOT NULL DEFAULT 'OPERATIONAL_TELEMETRY',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_attempt_task ON workflow.attempt(task_id, attempt_no DESC);
CREATE INDEX idx_attempt_status ON workflow.attempt(tenant_id, status);

COMMENT ON TABLE workflow.attempt IS '任务执行尝试记录';

-- 1.5 timer - 定时器
CREATE TABLE workflow.timer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    workflow_instance_id UUID REFERENCES workflow.instance(id) ON DELETE CASCADE,
    task_id UUID REFERENCES workflow.task(id) ON DELETE SET NULL,
    timer_type VARCHAR(50) NOT NULL,
    fire_at TIMESTAMPTZ NOT NULL,
    fired_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    classification data_classification NOT NULL DEFAULT 'OPERATIONAL_TELEMETRY',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_timer_fire ON workflow.timer(status, fire_at)
    WHERE status = 'SCHEDULED';
CREATE INDEX idx_timer_task ON workflow.timer(task_id);

COMMENT ON TABLE workflow.timer IS '工作流定时器';

-- ============================================================
-- 2. cde 领域 - 资产、版本、状态
-- ============================================================

-- 2.1 asset - 资产（稳定对象）
CREATE TABLE cde.asset (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    asset_type VARCHAR(100) NOT NULL,
    discipline VARCHAR(100),
    code VARCHAR(200) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    current_version_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    folder_path VARCHAR(500),
    tags TEXT[] NOT NULL DEFAULT '{}',
    extensions JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE UNIQUE INDEX idx_asset_project_code
    ON cde.asset(project_id, code) WHERE deleted_at IS NULL;
CREATE INDEX idx_asset_project_type
    ON cde.asset(project_id, asset_type, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_asset_discipline
    ON cde.asset(project_id, discipline) WHERE deleted_at IS NULL;
CREATE INDEX idx_asset_tags ON cde.asset USING GIN(tags) WHERE deleted_at IS NULL;

COMMENT ON TABLE cde.asset IS '资产表（D34.5 cde 聚合根）';
COMMENT ON COLUMN cde.asset.code IS '资产编号，项目内唯一';

-- 2.2 asset_version - 资产版本（不可变修订）
CREATE TABLE cde.asset_version (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES cde.asset(id) ON DELETE CASCADE,
    revision_no BIGINT NOT NULL,
    version_label VARCHAR(100),
    status revision_status NOT NULL DEFAULT 'DRAFT',
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    media_type VARCHAR(200),
    sha256_hash VARCHAR(64) NOT NULL,
    source_tool VARCHAR(100),
    source_version VARCHAR(100),
    description TEXT,
    change_summary TEXT,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    extensions JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    superseded_by UUID REFERENCES cde.asset_version(id)
);

CREATE UNIQUE INDEX idx_asset_version_revision
    ON cde.asset_version(asset_id, revision_no);
CREATE UNIQUE INDEX idx_asset_version_hash
    ON cde.asset_version(tenant_id, sha256_hash);
CREATE INDEX idx_asset_version_status
    ON cde.asset_version(asset_id, status);
CREATE INDEX idx_asset_version_created
    ON cde.asset_version(project_id, created_at DESC);

COMMENT ON TABLE cde.asset_version IS '资产版本（不可变修订模型）';
COMMENT ON COLUMN cde.asset_version.sha256_hash IS '内容 SHA-256 哈希，内容不可变（D34.8.1 关键约束）';

-- 2.3 object_manifest - 对象存储清单
CREATE TABLE cde.object_manifest (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    asset_version_id UUID NOT NULL REFERENCES cde.asset_version(id) ON DELETE CASCADE,
    bucket_name VARCHAR(255) NOT NULL,
    object_key VARCHAR(1000) NOT NULL,
    object_version_id VARCHAR(255),
    region VARCHAR(100) NOT NULL,
    storage_class VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    encryption_key_ref VARCHAR(500),
    scan_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    scan_result JSONB,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_manifest_asset_version
    ON cde.object_manifest(asset_version_id);
CREATE INDEX idx_manifest_bucket_key
    ON cde.object_manifest(bucket_name, object_key);

COMMENT ON TABLE cde.object_manifest IS '对象存储清单（D34.12）';
COMMENT ON COLUMN cde.object_manifest.object_key IS '对象存储 Key，格式：tenant/project/classification/object_id/version_id';

-- 2.4 rendition - 渲染/预览
CREATE TABLE cde.rendition (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    asset_version_id UUID NOT NULL REFERENCES cde.asset_version(id) ON DELETE CASCADE,
    rendition_type VARCHAR(100) NOT NULL,
    format VARCHAR(50) NOT NULL,
    width INTEGER,
    height INTEGER,
    file_size BIGINT NOT NULL DEFAULT 0,
    sha256_hash VARCHAR(64),
    object_key VARCHAR(1000),
    generator VARCHAR(200),
    generator_version VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    classification data_classification NOT NULL DEFAULT 'WORKING',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_rendition_asset ON cde.rendition(asset_version_id);
CREATE INDEX idx_rendition_type ON cde.rendition(asset_version_id, rendition_type);

COMMENT ON TABLE cde.rendition IS '资产渲染/预览（可重建派生）';

-- 2.5 baseline_item - 基线项
CREATE TABLE cde.baseline_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    baseline_id UUID NOT NULL REFERENCES portfolio.project_baseline(id) ON DELETE CASCADE,
    asset_version_id UUID NOT NULL REFERENCES cde.asset_version(id),
    item_type VARCHAR(100) NOT NULL DEFAULT 'ASSET_VERSION',
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    classification data_classification NOT NULL DEFAULT 'PUBLISHED_EVIDENCE',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_baseline_item_unique
    ON cde.baseline_item(baseline_id, asset_version_id, item_type);
CREATE INDEX idx_baseline_item_baseline ON cde.baseline_item(baseline_id);

COMMENT ON TABLE cde.baseline_item IS '基线项（引用精确版本+hash）';

-- 2.6 transmittal - 交付/传送
CREATE TABLE cde.transmittal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    transmittal_no VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    purpose VARCHAR(200),
    sender_id UUID REFERENCES iam.principal(id),
    recipient TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    sent_at TIMESTAMPTZ,
    classification data_classification NOT NULL DEFAULT 'PUBLISHED_EVIDENCE',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_transmittal_no
    ON cde.transmittal(project_id, transmittal_no);
CREATE INDEX idx_transmittal_status
    ON cde.transmittal(project_id, status, created_at DESC);

COMMENT ON TABLE cde.transmittal IS '交付/传送记录';
