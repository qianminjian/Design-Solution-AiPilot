-- V7__init_compliance_rules.sql
-- 合规规则域 - 规则/版本/规则集/检查运行/执行/结果/发现
--
-- 设计依据：
--   - @design/D21-规则-合规检查.md（D21.5 领域对象、D21.10 执行语义）
--   - @design/D34-数据-数据库.md §D34.5（聚合根）
--   - database.md（审计字段、命名约定）
--
-- PII 分级：
--   - compliance_rules.basis: L4 规范依据
--   - rule_revisions.dsl_json: L4 规则定义
--   - check_results.evidence_json: L4 证据数据
--   - compliance_findings: L5 合规发现（需专业处理）

CREATE SCHEMA IF NOT EXISTS compliance;

-- ============================================================
-- 1. compliance.compliance_rules - 规则身份（稳定身份，多版本指向同一规则）
-- ============================================================
CREATE TABLE compliance.compliance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    rule_code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    owner UUID REFERENCES iam.principal(id),
    status VARCHAR(50) NOT NULL DEFAULT 'CANDIDATE',
    description TEXT,
    basis JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE UNIQUE INDEX idx_compliance_rules_code
    ON compliance.compliance_rules(tenant_id, rule_code)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_compliance_rules_category
    ON compliance.compliance_rules(tenant_id, category, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_compliance_rules_owner
    ON compliance.compliance_rules(owner, status)
    WHERE owner IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE compliance.compliance_rules IS '合规规则身份（D21.5）';
COMMENT ON COLUMN compliance.compliance_rules.rule_code IS '规则编码：如 FIRE-EGRESS-TRAVEL-001';
COMMENT ON COLUMN compliance.compliance_rules.category IS '规则类别：INFORMATION/GEOMETRY/PROPERTY/SPATIAL/EGRESS/ACCESSIBILITY/FIRE_SAFETY/ENERGY/DRAWING/CROSS_ARTIFACT';
COMMENT ON COLUMN compliance.compliance_rules.status IS '规则状态：CANDIDATE/DRAFT/TEST_READY/TECHNICAL_REVIEW/PROFESSIONAL_REVIEW/APPROVED/ACTIVE/SUPERSEDED/SUSPENDED/RETIRED';

-- ============================================================
-- 2. compliance.rule_revisions - 可执行规则版本（不可变，DSL JSON 存储）
-- ============================================================
CREATE TABLE compliance.rule_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES compliance.compliance_rules(id) ON DELETE CASCADE,
    revision_no BIGINT NOT NULL,
    dsl_json JSONB NOT NULL,
    parameters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    basis JSONB NOT NULL DEFAULT '{}'::jsonb,
    engine_profile VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE UNIQUE INDEX idx_rule_revisions_rule_version
    ON compliance.rule_revisions(rule_id, revision_no)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_rule_revisions_status
    ON compliance.rule_revisions(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_rule_revisions_engine
    ON compliance.rule_revisions(engine_profile)
    WHERE engine_profile IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE compliance.rule_revisions IS '可执行规则版本（D21.5）';
COMMENT ON COLUMN compliance.rule_revisions.revision_no IS '修订号（规则内单调递增）';
COMMENT ON COLUMN compliance.rule_revisions.dsl_json IS '规则 DSL/IDS 定义（JSONB）';
COMMENT ON COLUMN compliance.rule_revisions.engine_profile IS '引擎配置文件引用';
COMMENT ON COLUMN compliance.rule_revisions.status IS '版本状态：DRAFT/TEST_READY/APPROVED/ACTIVE/SUPERSEDED/SUSPENDED';

-- ============================================================
-- 3. compliance.compliance_rule_sets - 规则集（阶段/用途规则集合）
-- ============================================================
CREATE TABLE compliance.compliance_rule_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stage_code VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE UNIQUE INDEX idx_compliance_rule_sets_name
    ON compliance.compliance_rule_sets(tenant_id, name)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_compliance_rule_sets_stage
    ON compliance.compliance_rule_sets(tenant_id, stage_code, status)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE compliance.compliance_rule_sets IS '合规规则集（D21.5）';
COMMENT ON COLUMN compliance.compliance_rule_sets.stage_code IS '适用阶段编码：STG-P0 ~ STG-P8';

-- ============================================================
-- 4. compliance.rule_set_rules - 规则集-规则版本关联（多对多）
-- ============================================================
CREATE TABLE compliance.rule_set_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_set_id UUID NOT NULL REFERENCES compliance.compliance_rule_sets(id) ON DELETE CASCADE,
    revision_id UUID NOT NULL REFERENCES compliance.rule_revisions(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_rule_set_rules_unique
    ON compliance.rule_set_rules(rule_set_id, revision_id);
CREATE INDEX idx_rule_set_rules_revision
    ON compliance.rule_set_rules(revision_id);

COMMENT ON TABLE compliance.rule_set_rules IS '规则集与规则版本关联表';
COMMENT ON COLUMN compliance.rule_set_rules.priority IS '执行优先级（数值越小优先级越高）';

-- ============================================================
-- 5. compliance.compliance_check_runs - 检查运行（一次完整检查）
-- ============================================================
CREATE TABLE compliance.compliance_check_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    project_id UUID REFERENCES portfolio.project(id),
    rule_set_id UUID NOT NULL REFERENCES compliance.compliance_rule_sets(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    outcome_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_compliance_check_runs_project
    ON compliance.compliance_check_runs(project_id, created_at DESC)
    WHERE project_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_compliance_check_runs_rule_set
    ON compliance.compliance_check_runs(rule_set_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_compliance_check_runs_status
    ON compliance.compliance_check_runs(status)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE compliance.compliance_check_runs IS '合规检查运行（D21.5）';
COMMENT ON COLUMN compliance.compliance_check_runs.status IS '运行状态：PENDING/STARTED/COMPLETED/PARTIAL/FAILED';
COMMENT ON COLUMN compliance.compliance_check_runs.outcome_summary IS '结果摘要：各 outcome 计数统计';

-- ============================================================
-- 6. compliance.rule_executions - 单规则执行记录
-- ============================================================
CREATE TABLE compliance.rule_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES compliance.compliance_check_runs(id) ON DELETE CASCADE,
    revision_id UUID NOT NULL REFERENCES compliance.rule_revisions(id) ON DELETE CASCADE,
    applicability_count BIGINT NOT NULL DEFAULT 0,
    pass_count BIGINT NOT NULL DEFAULT 0,
    fail_count BIGINT NOT NULL DEFAULT 0,
    not_applicable_count BIGINT NOT NULL DEFAULT 0,
    indeterminate_count BIGINT NOT NULL DEFAULT 0,
    error_count BIGINT NOT NULL DEFAULT 0,
    manual_review_count BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    duration_ms BIGINT,
    logs TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_rule_executions_run
    ON compliance.rule_executions(run_id);
CREATE INDEX idx_rule_executions_revision
    ON compliance.rule_executions(revision_id);
CREATE INDEX idx_rule_executions_status
    ON compliance.rule_executions(run_id, status);

COMMENT ON TABLE compliance.rule_executions IS '单规则执行记录（D21.5）';
COMMENT ON COLUMN compliance.rule_executions.status IS '执行状态：PENDING/RUNNING/PASSED/FAILED/ERROR/SKIPPED';

-- ============================================================
-- 7. compliance.check_results - 对象级检查结果
-- ============================================================
CREATE TABLE compliance.check_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    execution_id UUID NOT NULL REFERENCES compliance.rule_executions(id) ON DELETE CASCADE,
    object_id UUID,
    object_type VARCHAR(100),
    outcome VARCHAR(50) NOT NULL,
    measured_value TEXT,
    threshold TEXT,
    explanation TEXT,
    evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_check_results_execution
    ON compliance.check_results(execution_id);
CREATE INDEX idx_check_results_object
    ON compliance.check_results(object_type, object_id);
CREATE INDEX idx_check_results_outcome
    ON compliance.check_results(execution_id, outcome);

COMMENT ON TABLE compliance.check_results IS '对象级检查结果（D21.5）';
COMMENT ON COLUMN compliance.check_results.outcome IS '判定结果：PASS/FAIL/NOT_APPLICABLE/INDETERMINATE/ERROR/MANUAL_REVIEW';

-- ============================================================
-- 8. compliance.compliance_findings - 合规发现（需治理的问题）
-- ============================================================
CREATE TABLE compliance.compliance_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    result_id UUID NOT NULL REFERENCES compliance.check_results(id) ON DELETE CASCADE,
    severity VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    assigned_to UUID REFERENCES iam.principal(id),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_compliance_findings_result
    ON compliance.compliance_findings(result_id);
CREATE INDEX idx_compliance_findings_severity
    ON compliance.compliance_findings(severity, status);
CREATE INDEX idx_compliance_findings_assigned
    ON compliance.compliance_findings(assigned_to, status)
    WHERE assigned_to IS NOT NULL;

COMMENT ON TABLE compliance.compliance_findings IS '合规发现（D21.5）';
COMMENT ON COLUMN compliance.compliance_findings.severity IS '严重度：CRITICAL/HIGH/MEDIUM/LOW';
COMMENT ON COLUMN compliance.compliance_findings.status IS '发现状态：OPEN/IN_PROGRESS/VERIFIED/CLOSED/REOPENED';

-- ============================================================
-- 9. 为新增表创建 updated_at 触发器
-- ============================================================
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at'
          AND table_schema = 'compliance'
          AND table_name IN ('compliance_rules', 'rule_revisions', 'compliance_rule_sets',
                             'compliance_check_runs', 'rule_executions', 'compliance_findings',
                             'rule_set_rules', 'check_results')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_timestamp ON compliance.%I', t);
        EXECUTE format('CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON compliance.%I
            FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp()', t);
    END LOOP;
END $$;