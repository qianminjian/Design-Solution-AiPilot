-- V6__init_workflow_stage_gate_baseline.sql
-- workflow 领域 - 阶段实例/门禁决策/项目基线（独立于 portfolio 域，带软删除）
--
-- 设计依据：
--   - @design/D05-全流程阶段-阶段门.md（D05.4.1 阶段状态机）
--   - @design/D34-数据-数据库.md §D34.5（聚合根）
--   - workflow.contract.ts（API 契约）
--
-- 与 portfolio.stage_instance / portfolio.gate_decision / portfolio.project_baseline 的区别：
--   - workflow 域表带 deleted_at / deleted_by 软删除字段（@Where 过滤）
--   - workflow 域聚焦"工作流操作"（流转/决策/冻结），portfolio 域聚焦"项目组合管理"
--   - 两套表通过 project_id 外键关联到 portfolio.project（同一项目根）
--
-- PII 分级：
--   - stage_instance.metadata: L3 业务数据
--   - gate_decision.evidence: L4 已发布证据
--   - project_baseline: L5 业务核心设计文件（基线即冻结的设计成果）

-- ============================================================
-- 1. workflow.stage_instance - 阶段实例（带软删除）
-- ============================================================
CREATE TABLE workflow.stage_instance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    stage_code VARCHAR(100) NOT NULL,
    stage_name VARCHAR(255) NOT NULL,
    stage_order INTEGER NOT NULL,
    -- 阶段状态：NOT_STARTED / PLANNED / ACTIVE / REVIEW_PREPARING / UNDER_REVIEW 等（D05.4.1）
    status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    -- 软删除字段
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE UNIQUE INDEX idx_wf_stage_project_order
    ON workflow.stage_instance(project_id, stage_order)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_wf_stage_project_status
    ON workflow.stage_instance(project_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_wf_stage_tenant_status
    ON workflow.stage_instance(tenant_id, status)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE workflow.stage_instance IS '工作流阶段实例（D05 阶段，带软删除）';
COMMENT ON COLUMN workflow.stage_instance.stage_code IS '阶段编码：STG-P0 ~ STG-P8';
COMMENT ON COLUMN workflow.stage_instance.status IS '阶段状态机见 D05.4.1';

-- ============================================================
-- 2. workflow.gate_decision - 门禁决策（带软删除）
-- ============================================================
CREATE TABLE workflow.gate_decision (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES workflow.stage_instance(id) ON DELETE SET NULL,
    gate_code VARCHAR(100) NOT NULL,
    gate_name VARCHAR(255) NOT NULL,
    -- 门禁状态：PENDING / DECIDED / CANCELLED
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    -- 决策结论：APPROVED / CONDITIONALLY_APPROVED / REWORK_REQUIRED / SUSPENDED / CANCELLED
    decision VARCHAR(50),
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES iam.principal(id),
    -- 关联基线 ID（核心不变量：必须引用 PUBLISHED 状态基线）
    baseline_id UUID,
    comment TEXT,
    classification data_classification NOT NULL DEFAULT 'PUBLISHED_EVIDENCE',
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    -- 软删除字段
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_wf_gate_project ON workflow.gate_decision(project_id, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_wf_gate_status ON workflow.gate_decision(project_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_wf_gate_stage ON workflow.gate_decision(stage_id)
    WHERE stage_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE workflow.gate_decision IS '工作流门禁决策（D05 阶段门，带软删除）';
COMMENT ON COLUMN workflow.gate_decision.baseline_id IS '关联基线 ID，必须为 PUBLISHED 状态（核心不变量）';

-- ============================================================
-- 3. workflow.project_baseline - 项目基线（带软删除）
-- ============================================================
CREATE TABLE workflow.project_baseline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES portfolio.project(id) ON DELETE CASCADE,
    -- 修订号（项目内单调递增，冻结时取 max + 1）
    revision_no BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    -- 修订状态：DRAFT / PUBLISHED / SUPERSEDED（PUBLISHED 即冻结可被门禁引用）
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
    row_version BIGINT NOT NULL DEFAULT 1,
    -- 软删除字段
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE UNIQUE INDEX idx_wf_baseline_project_revision
    ON workflow.project_baseline(project_id, revision_no)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_wf_baseline_project_status
    ON workflow.project_baseline(project_id, status)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE workflow.project_baseline IS '工作流项目基线（冻结版本，带软删除）';
COMMENT ON COLUMN workflow.project_baseline.revision_no IS '基线修订号，单调递增（D34.6）';
COMMENT ON COLUMN workflow.project_baseline.status IS 'PUBLISHED 即冻结，可被门禁引用';

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
          AND table_schema = 'workflow'
          AND table_name IN ('stage_instance', 'gate_decision', 'project_baseline')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_timestamp ON workflow.%I', t);
        EXECUTE format('CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON workflow.%I
            FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp()', t);
    END LOOP;
END $$;
