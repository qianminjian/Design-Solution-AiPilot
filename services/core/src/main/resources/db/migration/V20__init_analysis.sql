-- V20__init_analysis.sql
-- 工程分析域 - D37.14 P10 工程分析运行与结果质量 9 个子域数据库 Schema
--
-- 设计依据：
--   - @design/D37-关键界面-交互状态.md §D37.14（工程分析运行与结果质量）
--   - @design/D35-API-事件契约.md（Analysis 域契约）
--   - @design/D42-SLO-容量.md（运行容量与并发限制）
--   - database.md（审计字段、命名约定）
--   - security.md（PII 分级、字段加密）
--   - design-constraints.md（AI 安全红线、完成运行 ≠ 接受结果）
--
-- 子域：
--   1. analysis_problem            - 工程分析问题（核心实体）
--   2. solver_profile              - 求解器配置
--   3. analysis_scenario           - 分析场景
--   4. simulation_run              - 模拟运行
--   5. run_timeline_event           - 运行时间线事件
--   6. convergence_metric           - 收敛指标
--   7. analysis_result             - 分析结果
--   8. result_quality_assessment   - 结果质量评估
--   9. mesh_quality                - 网格质量摘要
--
-- 安全红线：
--   - 高风险动作（submit/invalidate/cancel/retry/impact-proposal）需 stepUpToken
--   - 质量评估决策（ACCEPT_AS_REVISION/EXCEPTION）需注册师签章
--   - 完成运行 ≠ 接受结果：质量评估须由具备资质的人员完成
--   - AI 辅助推荐场景/参数须人工确认
--   - retry storm 检测（V0 占位：retry_count 阈值由 Service 层校验）
--   - unknown job 显式标识（is_unknown_job=true，需 Reconcile）
--   - supersede 需记录取代关系（superseded_by + superseded_at）
--
-- PII 分级：
--   - analysis_problem.owner: L2 间接识别信息
--   - simulation_run.cancelled_by: L2 间接识别信息
--   - result_quality_assessment.assessor_id: L2 间接识别信息
--   - analysis_result.download_url: L4 专业设计成果（访问控制 + 版本追溯）

CREATE SCHEMA IF NOT EXISTS analysis;

-- ============================================================
-- 1. analysis.analysis_problem - 工程分析问题（D37.14 核心实体）
-- ============================================================
CREATE TABLE analysis.analysis_problem (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    title VARCHAR(500) NOT NULL,
    type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    description VARCHAR(4000),
    project_id VARCHAR(64) NOT NULL,
    project_name VARCHAR(200),
    baseline_id VARCHAR(64),
    baseline_hash VARCHAR(128),
    owner VARCHAR(200) NOT NULL,
    owner_role VARCHAR(100) NOT NULL,
    input_completeness INTEGER NOT NULL DEFAULT 0,
    assumption_count INTEGER NOT NULL DEFAULT 0,
    boundary_condition_count INTEGER NOT NULL DEFAULT 0,
    load_case_count INTEGER NOT NULL DEFAULT 0,
    run_count INTEGER NOT NULL DEFAULT 0,
    latest_run_id UUID,
    latest_run_status VARCHAR(32),
    latest_result_quality VARCHAR(32),
    requires_human_review BOOLEAN NOT NULL DEFAULT FALSE,
    is_ai_assisted BOOLEAN NOT NULL DEFAULT FALSE,
    ai_assisted_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMPTZ,
    invalidated_at TIMESTAMPTZ,
    invalidation_reason VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id),
    CONSTRAINT uq_analysis_problem_code UNIQUE (code)
);

CREATE INDEX idx_analysis_problem_tenant_status
    ON analysis.analysis_problem(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_analysis_problem_tenant_project
    ON analysis.analysis_problem(tenant_id, project_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_analysis_problem_tenant_type
    ON analysis.analysis_problem(tenant_id, type)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_analysis_problem_tenant_owner
    ON analysis.analysis_problem(tenant_id, owner)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE analysis.analysis_problem IS '工程分析问题（D37.14，PII: L2 owner）';
COMMENT ON COLUMN analysis.analysis_problem.type IS '问题类型：STRUCTURAL/WIND/THERMAL/ENERGY/LIGHTING/ACOUSTIC/DAYLIGHT/FIRE/GEOTECHNICAL/OTHER';
COMMENT ON COLUMN analysis.analysis_problem.status IS '问题状态：DRAFT/READY/RUNNING/COMPLETED/REVIEWED/INVALID';
COMMENT ON COLUMN analysis.analysis_problem.input_completeness IS '输入完整性百分比（0-100）';
COMMENT ON COLUMN analysis.analysis_problem.baseline_hash IS 'Baseline Hash（用于变更检测，输入基线变化触发 INVALID）';
COMMENT ON COLUMN analysis.analysis_problem.requires_human_review IS '是否需要人工复核（AI 辅助标记或高风险问题强制 true）';
COMMENT ON COLUMN analysis.analysis_problem.is_ai_assisted IS '是否 AI 辅助（场景推荐/参数优化须人工确认）';

-- ============================================================
-- 2. analysis.solver_profile - 求解器配置（D37.14）
-- ============================================================
CREATE TABLE analysis.solver_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(200) NOT NULL,
    solver_type VARCHAR(32) NOT NULL,
    version VARCHAR(64) NOT NULL,
    description VARCHAR(2000),
    max_concurrent_runs INTEGER NOT NULL DEFAULT 1,
    max_duration_sec INTEGER NOT NULL DEFAULT 3600,
    license_pool VARCHAR(500),
    is_internal BOOLEAN NOT NULL DEFAULT TRUE,
    region VARCHAR(64),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    supported_problem_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id),
    CONSTRAINT uq_solver_profile_code UNIQUE (code)
);

CREATE INDEX idx_solver_profile_tenant_active
    ON analysis.solver_profile(tenant_id, is_active)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_solver_profile_tenant_type
    ON analysis.solver_profile(tenant_id, solver_type)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE analysis.solver_profile IS '求解器配置（D37.14，V0 内置配置，V1 接入外部 Solver Provider）';
COMMENT ON COLUMN analysis.solver_profile.solver_type IS '求解器类型：FEA/CFD/THERMAL/ENERGY/LIGHTING/ACOUSTIC/STRUCTURAL';
COMMENT ON COLUMN analysis.solver_profile.max_concurrent_runs IS '最大并发运行数（D42 容量约束）';
COMMENT ON COLUMN analysis.solver_profile.is_internal IS '是否内置求解器（外部 Provider 需 ManualHandoff）';
COMMENT ON COLUMN analysis.solver_profile.region IS '运行 Region（Hybrid-Site 数据驻留约束）';

-- ============================================================
-- 3. analysis.analysis_scenario - 分析场景（D37.14）
-- ============================================================
CREATE TABLE analysis.analysis_scenario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES analysis.analysis_problem(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    description VARCHAR(2000),
    scenario_type VARCHAR(32) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_baseline BOOLEAN NOT NULL DEFAULT FALSE,
    is_ai_recommended BOOLEAN NOT NULL DEFAULT FALSE,
    ai_recommendation_reason VARCHAR(2000),
    confirmed_by VARCHAR(200),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_analysis_scenario_tenant_problem
    ON analysis.analysis_scenario(tenant_id, problem_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_analysis_scenario_tenant_baseline
    ON analysis.analysis_scenario(tenant_id, is_baseline)
    WHERE deleted_at IS NULL AND is_baseline = TRUE;

COMMENT ON TABLE analysis.analysis_scenario IS '分析场景（D37.14，AI 推荐场景须人工确认 is_ai_recommended → confirmed_by）';
COMMENT ON COLUMN analysis.analysis_scenario.scenario_type IS '场景类型：BASELINE/WHAT_IF/OPTIMIZATION/SENSITIVITY/VERIFICATION';
COMMENT ON COLUMN analysis.analysis_scenario.is_ai_recommended IS '是否 AI 推荐（须人工确认后才可用于运行）';
COMMENT ON COLUMN analysis.analysis_scenario.confirmed_by IS '确认人（AI 推荐场景须由具备资质的人员确认）';

-- ============================================================
-- 4. analysis.simulation_run - 模拟运行（D37.14）
-- ============================================================
CREATE TABLE analysis.simulation_run (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES analysis.analysis_problem(id) ON DELETE CASCADE,
    scenario_id UUID NOT NULL REFERENCES analysis.analysis_scenario(id) ON DELETE CASCADE,
    solver_profile_id UUID NOT NULL REFERENCES analysis.solver_profile(id),
    solver_profile_name VARCHAR(200),
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    solver_version VARCHAR(64),
    actual_duration_sec INTEGER,
    actual_cost NUMERIC(12, 4),
    failure_reason VARCHAR(2000),
    retry_count INTEGER NOT NULL DEFAULT 0,
    parent_run_id UUID,
    is_unknown_job BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_by VARCHAR(200),
    cancel_reason VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_simulation_run_tenant_status
    ON analysis.simulation_run(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_simulation_run_tenant_problem
    ON analysis.simulation_run(tenant_id, problem_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_simulation_run_tenant_scenario
    ON analysis.simulation_run(tenant_id, scenario_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_simulation_run_tenant_unknown
    ON analysis.simulation_run(tenant_id, is_unknown_job)
    WHERE deleted_at IS NULL AND is_unknown_job = TRUE;
CREATE INDEX idx_simulation_run_parent
    ON analysis.simulation_run(tenant_id, parent_run_id)
    WHERE deleted_at IS NULL AND parent_run_id IS NOT NULL;

COMMENT ON TABLE analysis.simulation_run IS '模拟运行（D37.14，PII: L2 cancelled_by）';
COMMENT ON COLUMN analysis.simulation_run.status IS '运行状态：QUEUED/LICENSING/PREPARING/RUNNING/POST_PROCESSING/CONVERGED/DIVERGED/CANCELLED/FAILED/UNKNOWN';
COMMENT ON COLUMN analysis.simulation_run.retry_count IS '重试次数（retry storm 检测依据，阈值由 Service 层校验）';
COMMENT ON COLUMN analysis.simulation_run.is_unknown_job IS '是否为 unknown job（需 Reconcile，D37.17 retry storm 防护）';
COMMENT ON COLUMN analysis.simulation_run.parent_run_id IS '上游运行 ID（重试链）';

-- ============================================================
-- 5. analysis.run_timeline_event - 运行时间线事件（D37.14）
-- ============================================================
CREATE TABLE analysis.run_timeline_event (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES analysis.simulation_run(id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL,
    status_from VARCHAR(32),
    status_to VARCHAR(32),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER,
    operator_id VARCHAR(200),
    message VARCHAR(2000),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    trace_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_run_timeline_event_tenant_run
    ON analysis.run_timeline_event(tenant_id, run_id, occurred_at)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_run_timeline_event_tenant_type
    ON analysis.run_timeline_event(tenant_id, event_type)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE analysis.run_timeline_event IS '运行时间线事件（D37.14，PII: L2 operator_id）';
COMMENT ON COLUMN analysis.run_timeline_event.event_type IS '事件类型：QUEUED/LICENSING/PREPARING/RUNNING/POST_PROCESSING/CONVERGED/DIVERGED/CANCELLED/FAILED/UNKNOWN/RETRY/RECONCILE';
COMMENT ON COLUMN analysis.run_timeline_event.trace_id IS '全链路追踪 ID（关联 D35 traceId）';

-- ============================================================
-- 6. analysis.convergence_metric - 收敛指标（D37.14）
-- ============================================================
CREATE TABLE analysis.convergence_metric (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES analysis.simulation_run(id) ON DELETE CASCADE,
    iteration INTEGER NOT NULL,
    residual NUMERIC(12, 6) NOT NULL,
    convergence_status VARCHAR(16) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_convergence_metric_tenant_run_iter
    ON analysis.convergence_metric(tenant_id, run_id, iteration)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE analysis.convergence_metric IS '收敛指标（D37.14，记录每次迭代的残差与状态）';
COMMENT ON COLUMN analysis.convergence_metric.convergence_status IS '收敛状态：CONVERGING/CONVERGED/DIVERGING/DIVERGED';

-- ============================================================
-- 7. analysis.analysis_result - 分析结果（D37.14）
-- ============================================================
CREATE TABLE analysis.analysis_result (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES analysis.simulation_run(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES analysis.analysis_problem(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    quality_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    size_mb NUMERIC(12, 4) NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    time_steps INTEGER NOT NULL DEFAULT 0,
    spatial_points INTEGER NOT NULL DEFAULT 0,
    metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
    benchmark_comparison JSONB NOT NULL DEFAULT '{}'::jsonb,
    download_url VARCHAR(500),
    superseded_by UUID,
    superseded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_analysis_result_tenant_run
    ON analysis.analysis_result(tenant_id, run_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_analysis_result_tenant_problem
    ON analysis.analysis_result(tenant_id, problem_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_analysis_result_tenant_quality
    ON analysis.analysis_result(tenant_id, quality_status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_analysis_result_superseded
    ON analysis.analysis_result(tenant_id, superseded_by)
    WHERE deleted_at IS NULL AND superseded_by IS NOT NULL;

COMMENT ON TABLE analysis.analysis_result IS '分析结果（D37.14，PII: L4 download_url 专业设计成果）';
COMMENT ON COLUMN analysis.analysis_result.quality_status IS '结果质量状态：PENDING/VALID/QUESTIONABLE/INVALID/SUPERSEDED';
COMMENT ON COLUMN analysis.analysis_result.metrics IS '关键指标摘要（JSON 数组：[{name, value, unit, withinThreshold, threshold?}]）';
COMMENT ON COLUMN analysis.analysis_result.benchmark_comparison IS 'Benchmark 对比（JSON：{benchmarkName, deviationPercent, passed}）';
COMMENT ON COLUMN analysis.analysis_result.superseded_by IS '被哪个结果取代（supersede 操作记录）';

-- ============================================================
-- 8. analysis.result_quality_assessment - 结果质量评估（D37.14）
-- ============================================================
CREATE TABLE analysis.result_quality_assessment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    result_id UUID NOT NULL REFERENCES analysis.analysis_result(id) ON DELETE CASCADE,
    decision VARCHAR(32) NOT NULL,
    checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    comment VARCHAR(4000) NOT NULL,
    assessor_id VARCHAR(200) NOT NULL,
    assessor_role VARCHAR(100) NOT NULL,
    assessor_qualification VARCHAR(200),
    step_up_token_hash VARCHAR(128),
    requires_seal BOOLEAN NOT NULL DEFAULT FALSE,
    seal_id VARCHAR(128),
    sealed_at TIMESTAMPTZ,
    assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_result_quality_assessment_tenant_result
    ON analysis.result_quality_assessment(tenant_id, result_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_result_quality_assessment_tenant_decision
    ON analysis.result_quality_assessment(tenant_id, decision)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_result_quality_assessment_tenant_assessor
    ON analysis.result_quality_assessment(tenant_id, assessor_id)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE analysis.result_quality_assessment IS '结果质量评估（D37.14，PII: L2 assessor_id）';
COMMENT ON COLUMN analysis.result_quality_assessment.decision IS '评估决策：ACCEPT_AS_REVISION/EXCEPTION/REJECT/NEEDS_MORE_INFO';
COMMENT ON COLUMN analysis.result_quality_assessment.checklist IS '评估检查清单（JSON 数组：[{item, passed, comment?}]）';
COMMENT ON COLUMN analysis.result_quality_assessment.requires_seal IS '是否需要注册师签章（ACCEPT_AS_REVISION/EXCEPTION 强制 true）';
COMMENT ON COLUMN analysis.result_quality_assessment.seal_id IS '签章 ID（关联电子签章系统）';
COMMENT ON COLUMN analysis.result_quality_assessment.step_up_token_hash IS 'Step-up Token 哈希（高风险决策二次认证）';

-- ============================================================
-- 9. analysis.mesh_quality - 网格质量摘要（D37.14）
-- ============================================================
CREATE TABLE analysis.mesh_quality (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES analysis.analysis_problem(id) ON DELETE CASCADE,
    total_elements BIGINT NOT NULL DEFAULT 0,
    total_nodes BIGINT NOT NULL DEFAULT 0,
    min_quality NUMERIC(8, 6) NOT NULL DEFAULT 0,
    max_quality NUMERIC(8, 6) NOT NULL DEFAULT 0,
    avg_quality NUMERIC(8, 6) NOT NULL DEFAULT 0,
    aspect_ratio_max NUMERIC(12, 4),
    aspect_ratio_avg NUMERIC(12, 4),
    skewness_max NUMERIC(8, 6),
    skewness_avg NUMERIC(8, 6),
    orthogonal_ratio_min NUMERIC(8, 6),
    poor_element_count BIGINT NOT NULL DEFAULT 0,
    poor_element_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    quality_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    assessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_mesh_quality_tenant_problem
    ON analysis.mesh_quality(tenant_id, problem_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_mesh_quality_tenant_status
    ON analysis.mesh_quality(tenant_id, quality_status)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE analysis.mesh_quality IS '网格质量摘要（D37.14，用于运行前的输入完整性校验）';
COMMENT ON COLUMN analysis.mesh_quality.quality_status IS '网格质量状态：PENDING/ACCEPTABLE/QUESTIONABLE/UNACCEPTABLE';
COMMENT ON COLUMN analysis.mesh_quality.poor_element_percent IS '差质量元素百分比（>5% 标记为 QUESTIONABLE）';
