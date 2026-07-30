-- V18__init_change.sql
-- 变更域 - D37.16 P12 变更影响与闭环工作台 4 个子域数据库 Schema
--
-- 设计依据：
--   - @design/D37-关键界面-交互状态.md（D37.16 变更影响与闭环工作台）
--   - @design/D34-数据-数据库.md §D34.5（聚合根）
--   - database.md（审计字段、命名约定）
--   - security.md（PII 分级、字段加密）
--   - design-constraints.md（AI 安全红线、职责分离原则）
--
-- 子域：
--   1. change_request    - 变更请求（核心实体）
--   2. affected_item     - 受影响项（子表）
--   3. task_plan_item    - 处置任务（子表）
--   4. closure_evidence  - 关闭证据（子表）
--   5. change_operation  - 变更操作阶段（时间线）
--
-- 安全红线：
--   - 高风险变更（CRITICAL 优先级）强制 stepUpToken 二次认证
--   - 批准人 ≠ 实施人 ≠ 关闭人（职责分离）
--   - UNKNOWN 影响项阻断关闭（必须先解决）
--   - 关闭前所有 blocksClosure=true 的任务必须 COMPLETED 或 SKIPPED
--   - 关闭前所有 blocksClosure=true 的证据必须 VERIFIED
--   - 高风险证据（AI_REVIEW/SIGNATURE）须双人复核
--
-- PII 分级：
--   - change_request.initiated_by/approved_by 等: L2 间接识别信息
--   - affected_item.owner: L2 间接识别信息
--   - change_operation.operator_id: L2 间接识别信息

CREATE SCHEMA IF NOT EXISTS change;

-- ============================================================
-- 1. change.change_request - 变更请求（D37.16 P12 核心实体）
-- ============================================================
CREATE TABLE change.change_request (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description VARCHAR(4000),
    type VARCHAR(32) NOT NULL,
    priority VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    project_id VARCHAR(64) NOT NULL,
    baseline_id VARCHAR(64),
    initiated_by VARCHAR(200) NOT NULL,
    initiated_at TIMESTAMPTZ NOT NULL,
    approved_by VARCHAR(200),
    approved_at TIMESTAMPTZ,
    implemented_by VARCHAR(200),
    implemented_at TIMESTAMPTZ,
    closed_by VARCHAR(200),
    closed_at TIMESTAMPTZ,
    impact_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
    confirmed_no_impact BOOLEAN NOT NULL DEFAULT FALSE,
    ai_assisted_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_ai_assisted BOOLEAN NOT NULL DEFAULT FALSE,
    risk_assessment VARCHAR(2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id),
    CONSTRAINT uq_change_request_code UNIQUE (code)
);

CREATE INDEX idx_change_request_tenant_status
    ON change.change_request(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_change_request_tenant_project
    ON change.change_request(tenant_id, project_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_change_request_tenant_type
    ON change.change_request(tenant_id, type)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_change_request_tenant_priority
    ON change.change_request(tenant_id, priority)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_change_request_initiated_by
    ON change.change_request(tenant_id, initiated_by)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE change.change_request IS '变更请求（D37.16 P12 变更影响与闭环工作台）';
COMMENT ON COLUMN change.change_request.code IS '业务编号，如 CHG-2026-001';
COMMENT ON COLUMN change.change_request.type IS '变更类型：REQUIREMENT/DESIGN/SCOPE/BASELINE/REGULATORY/OTHER';
COMMENT ON COLUMN change.change_request.priority IS '优先级：LOW/MEDIUM/HIGH/CRITICAL（CRITICAL 强制 stepUpToken）';
COMMENT ON COLUMN change.change_request.status IS '状态：DRAFT/SUBMITTED/IMPACT_ASSESSMENT/PENDING_APPROVAL/APPROVED/IN_PROGRESS/PENDING_VERIFICATION/CLOSED/REJECTED/RECALLED';
COMMENT ON COLUMN change.change_request.confirmed_no_impact IS '是否已确认无影响（区分"尚未分析"与"确认无影响"）';
COMMENT ON COLUMN change.change_request.is_ai_assisted IS 'AI 辅助标记（变更影响分析可由 AI 辅助）';

-- ============================================================
-- 2. change.affected_item - 受影响项（D37.16 P12）
-- ============================================================
CREATE TABLE change.affected_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    change_id UUID NOT NULL REFERENCES change.change_request(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    code VARCHAR(128) NOT NULL,
    name VARCHAR(500) NOT NULL,
    discipline VARCHAR(64) NOT NULL,
    action VARCHAR(16) NOT NULL,
    impact VARCHAR(16) NOT NULL,
    recheck_required BOOLEAN NOT NULL DEFAULT FALSE,
    recheck_status VARCHAR(16) NOT NULL DEFAULT 'NOT_REQUIRED',
    owner VARCHAR(200) NOT NULL,
    evidence VARCHAR(2000),
    source_baseline_id VARCHAR(64),
    watermark VARCHAR(64),
    object_ref_id VARCHAR(64),
    rechecked_at TIMESTAMPTZ,
    rechecked_by VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_affected_item_tenant_change
    ON change.affected_item(tenant_id, change_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_affected_item_change
    ON change.affected_item(change_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_affected_item_tenant_impact
    ON change.affected_item(tenant_id, impact)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_affected_item_tenant_recheck
    ON change.affected_item(tenant_id, recheck_status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_affected_item_object_ref
    ON change.affected_item(tenant_id, object_ref_id)
    WHERE deleted_at IS NULL AND object_ref_id IS NOT NULL;

COMMENT ON TABLE change.affected_item IS '受影响项（D37.16 P12，UNKNOWN 影响阻断关闭）';
COMMENT ON COLUMN change.affected_item.type IS '对象类型：REQUIREMENT/DESIGN_OPTION/DRAWING/MODEL/ANALYSIS_PROBLEM/ANALYSIS_SCENARIO/ANALYSIS_RESULT/COMPLIANCE_RULE/CHECK_RUN/FINDING/PUBLICATION/OTHER';
COMMENT ON COLUMN change.affected_item.action IS '变更动作：ADDED/MODIFIED/REMOVED/REPLACED/SUSPENDED';
COMMENT ON COLUMN change.affected_item.impact IS '影响判定：CONFIRMED/POTENTIAL/UNKNOWN/NO_IMPACT（UNKNOWN 阻断关闭）';
COMMENT ON COLUMN change.affected_item.recheck_status IS '复查状态：NOT_REQUIRED/PENDING/IN_PROGRESS/PASSED/FAILED/WAIVED';

-- ============================================================
-- 3. change.task_plan_item - 处置任务（D37.16 P12）
-- ============================================================
CREATE TABLE change.task_plan_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    change_id UUID NOT NULL REFERENCES change.change_request(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description VARCHAR(2000),
    assignee VARCHAR(200) NOT NULL,
    discipline VARCHAR(64),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    due_date TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    completed_by VARCHAR(200),
    affected_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    priority VARCHAR(16),
    sequence_order INTEGER,
    blocks_closure BOOLEAN NOT NULL DEFAULT TRUE,
    skip_reason VARCHAR(1000),
    skip_approved_by VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_task_plan_tenant_change
    ON change.task_plan_item(tenant_id, change_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_task_plan_change
    ON change.task_plan_item(change_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_task_plan_tenant_status
    ON change.task_plan_item(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_task_plan_assignee
    ON change.task_plan_item(tenant_id, assignee)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_task_plan_due_date
    ON change.task_plan_item(tenant_id, due_date)
    WHERE status IN ('PENDING', 'IN_PROGRESS') AND deleted_at IS NULL;

COMMENT ON TABLE change.task_plan_item IS '处置任务（D37.16 P12，关闭前所有阻断任务必须完成或跳过）';
COMMENT ON COLUMN change.task_plan_item.status IS '状态：PENDING/IN_PROGRESS/COMPLETED/SKIPPED/BLOCKED/CANCELLED';
COMMENT ON COLUMN change.task_plan_item.blocks_closure IS '是否阻断关闭（true 表示必须 COMPLETED 或 SKIPPED 才能关闭变更）';
COMMENT ON COLUMN change.task_plan_item.skip_reason IS '跳过原因（SKIPPED 时必填）';
COMMENT ON COLUMN change.task_plan_item.skip_approved_by IS '跳过审批人（SKIPPED 时必填，用于审计）';

-- ============================================================
-- 4. change.closure_evidence - 关闭证据（D37.16 P12）
-- ============================================================
CREATE TABLE change.closure_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    change_id UUID NOT NULL REFERENCES change.change_request(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(500) NOT NULL,
    source_id VARCHAR(64) NOT NULL,
    source_description VARCHAR(1000),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    verified_by VARCHAR(200),
    verified_at TIMESTAMPTZ,
    verification_note VARCHAR(2000),
    summary VARCHAR(2000) NOT NULL,
    evidence_url VARCHAR(500),
    blocks_closure BOOLEAN NOT NULL DEFAULT TRUE,
    submitted_by VARCHAR(200) NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL,
    reviewer1 VARCHAR(200),
    reviewer2 VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_closure_evidence_tenant_change
    ON change.closure_evidence(tenant_id, change_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_closure_evidence_change
    ON change.closure_evidence(change_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_closure_evidence_tenant_status
    ON change.closure_evidence(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_closure_evidence_tenant_type
    ON change.closure_evidence(tenant_id, type)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE change.closure_evidence IS '关闭证据（D37.16 P12，关闭前所有阻断证据必须 VERIFIED）';
COMMENT ON COLUMN change.closure_evidence.type IS '证据类型：DESIGN_REVIEW/RULE_RUN/AI_REVIEW/SIGNATURE/TEST_REPORT/VERIFICATION/OTHER';
COMMENT ON COLUMN change.closure_evidence.status IS '验证状态：PENDING/SUBMITTED/VERIFYING/VERIFIED/REJECTED/INVALID';
COMMENT ON COLUMN change.closure_evidence.blocks_closure IS '是否阻断关闭（true 表示必须 VERIFIED 才能关闭变更）';
COMMENT ON COLUMN change.closure_evidence.reviewer1 IS '复核人 1（高风险证据双人复核，AI_REVIEW/SIGNATURE 时必填）';
COMMENT ON COLUMN change.closure_evidence.reviewer2 IS '复核人 2（高风险证据双人复核，验证时必填，不可与 verified_by 相同）';

-- ============================================================
-- 5. change.change_operation - 变更操作阶段时间线（D37.16 P12）
-- ============================================================
CREATE TABLE change.change_operation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    change_id UUID NOT NULL REFERENCES change.change_request(id) ON DELETE CASCADE,
    phase VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    operator_id VARCHAR(200),
    operated_at TIMESTAMPTZ,
    comment VARCHAR(2000),
    from_status VARCHAR(32),
    to_status VARCHAR(32),
    sequence INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_change_operation_tenant_change
    ON change.change_operation(tenant_id, change_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_change_operation_change
    ON change.change_operation(change_id, sequence)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_change_operation_tenant_phase
    ON change.change_operation(tenant_id, phase)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE change.change_operation IS '变更操作阶段时间线（D37.16 P12，记录状态流转历史）';
COMMENT ON COLUMN change.change_operation.phase IS '阶段：CREATE_DRAFT/SUBMIT/IMPACT_ASSESSMENT/SUBMIT_IMPACT/APPROVE/REJECT/RECALL/START_IMPLEMENTATION/GENERATE_TASK_PLAN/SUBMIT_VERIFICATION/VERIFY_CLOSURE/CLOSED';
COMMENT ON COLUMN change.change_operation.status IS '阶段状态：COMPLETED/IN_PROGRESS/FAILED/SKIPPED';
COMMENT ON COLUMN change.change_operation.from_status IS '操作前变更状态';
COMMENT ON COLUMN change.change_operation.to_status IS '操作后变更状态';
COMMENT ON COLUMN change.change_operation.sequence IS '操作序号（按时间顺序递增）';
