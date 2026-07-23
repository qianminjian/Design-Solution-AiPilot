-- V2__init_portfolio_requirement.sql
-- portfolio（项目组合） + requirement（需求追踪）领域

-- ============================================================
-- 1. portfolio 领域 - 项目、阶段、门禁
-- ============================================================

-- 1.1 project - 项目
CREATE TABLE portfolio.project (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES iam.organization(id) ON DELETE SET NULL,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    building_type VARCHAR(100) NOT NULL DEFAULT 'OFFICE',
    floors_min INTEGER NOT NULL DEFAULT 5,
    floors_max INTEGER NOT NULL DEFAULT 15,
    gfa NUMERIC(20, 4),
    site_area NUMERIC(20, 4),
    region VARCHAR(100) NOT NULL DEFAULT 'us-east-1',
    language VARCHAR(20) NOT NULL DEFAULT 'en',
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    started_at TIMESTAMPTZ,
    target_completion_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE UNIQUE INDEX idx_project_tenant_code
    ON portfolio.project(tenant_id, code)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_project_tenant_status
    ON portfolio.project(tenant_id, status, updated_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE portfolio.project IS '项目表（D34.5 portfolio 聚合根）';
COMMENT ON COLUMN portfolio.project.floors_min IS '最小层数（OD-02：5 层下限）';
COMMENT ON COLUMN portfolio.project.floors_max IS '最大层数（OD-02：15 层上限）';
COMMENT ON COLUMN portfolio.project.gfa IS '总建筑面积 GFA，单位 m²（NUMERIC 精度）';

-- 1.2 stage_instance - 阶段实例
CREATE TABLE portfolio.stage_instance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    stage_code VARCHAR(100) NOT NULL,
    stage_name VARCHAR(255) NOT NULL,
    stage_order INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_stage_project_order
    ON portfolio.stage_instance(project_id, stage_order);
CREATE INDEX idx_stage_project_status
    ON portfolio.stage_instance(project_id, status);

COMMENT ON TABLE portfolio.stage_instance IS '项目阶段实例（D05 阶段）';

-- 1.3 gate_decision - 门禁决策
CREATE TABLE portfolio.gate_decision (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES portfolio.stage_instance(id) ON DELETE SET NULL,
    gate_code VARCHAR(100) NOT NULL,
    gate_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    decision VARCHAR(50),
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES iam.principal(id),
    baseline_id UUID,
    comment TEXT,
    classification data_classification NOT NULL DEFAULT 'PUBLISHED_EVIDENCE',
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_gate_project ON portfolio.gate_decision(project_id, created_at DESC);
CREATE INDEX idx_gate_status ON portfolio.gate_decision(project_id, status);

COMMENT ON TABLE portfolio.gate_decision IS '门禁决策（D05 阶段门）';

-- 1.4 project_baseline - 项目基线
CREATE TABLE portfolio.project_baseline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    revision_no BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    status revision_status NOT NULL DEFAULT 'DRAFT',
    frozen_at TIMESTAMPTZ,
    frozen_by UUID REFERENCES iam.principal(id),
    description TEXT,
    classification data_classification NOT NULL DEFAULT 'PUBLISHED_EVIDENCE',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_baseline_project_revision
    ON portfolio.project_baseline(project_id, revision_no);
CREATE INDEX idx_baseline_project_status
    ON portfolio.project_baseline(project_id, status);

COMMENT ON TABLE portfolio.project_baseline IS '项目基线（冻结版本）';
COMMENT ON COLUMN portfolio.project_baseline.revision_no IS '基线修订号，单调递增（D34.6）';

-- ============================================================
-- 2. requirement 领域 - 需求、资料、追踪
-- ============================================================

-- 2.1 source - 需求源（资料）
CREATE TABLE requirement.source (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    revision_no BIGINT NOT NULL,
    source_type VARCHAR(100) NOT NULL DEFAULT 'DOCUMENT',
    title VARCHAR(255) NOT NULL,
    status revision_status NOT NULL DEFAULT 'DRAFT',
    description TEXT,
    source_url VARCHAR(500),
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    superseded_by UUID REFERENCES requirement.source(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE UNIQUE INDEX idx_req_source_project_revision
    ON requirement.source(project_id, revision_no) WHERE deleted_at IS NULL;
CREATE INDEX idx_req_source_project_status
    ON requirement.source(project_id, status) WHERE deleted_at IS NULL;

COMMENT ON TABLE requirement.source IS '需求源/资料表';

-- 2.2 requirement_revision - 需求修订
CREATE TABLE requirement.requirement_revision (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    source_id UUID REFERENCES requirement.source(id) ON DELETE SET NULL,
    stable_id UUID NOT NULL,
    revision_no BIGINT NOT NULL,
    requirement_code VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    status revision_status NOT NULL DEFAULT 'DRAFT',
    category VARCHAR(100),
    verification_method VARCHAR(200),
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    extensions JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    superseded_by UUID
);

CREATE UNIQUE INDEX idx_req_stable_revision
    ON requirement.requirement_revision(stable_id, revision_no);
CREATE INDEX idx_req_project_status
    ON requirement.requirement_revision(project_id, status);
CREATE INDEX idx_req_source ON requirement.requirement_revision(source_id);

COMMENT ON TABLE requirement.requirement_revision IS '需求修订（不可变修订模型）';
COMMENT ON COLUMN requirement.requirement_revision.stable_id IS '稳定对象 ID，跨修订保持一致';

-- 2.3 trace_link - 追踪链接
CREATE TABLE requirement.trace_link (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    from_type VARCHAR(100) NOT NULL,
    from_id UUID NOT NULL,
    to_type VARCHAR(100) NOT NULL,
    to_id UUID NOT NULL,
    link_type VARCHAR(100) NOT NULL DEFAULT 'RELATED_TO',
    direction VARCHAR(20) NOT NULL DEFAULT 'BIDIRECTIONAL',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    confidence NUMERIC(5, 4) NOT NULL DEFAULT 1.0,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_trace_from ON requirement.trace_link(project_id, from_type, from_id);
CREATE INDEX idx_trace_to ON requirement.trace_link(project_id, to_type, to_id);
CREATE UNIQUE INDEX idx_trace_unique
    ON requirement.trace_link(project_id, from_type, from_id, to_type, to_id, link_type)
    WHERE status = 'ACTIVE';

COMMENT ON TABLE requirement.trace_link IS '需求追踪链接（D34.5 requirement 聚合）';
