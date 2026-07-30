-- V19__init_operations.sql
-- 运营域 - D37.17 运营中心 5 个子域数据库 Schema
--
-- 设计依据：
--   - @design/D37-关键界面-交互状态.md §D37.17（治理中心与运营中心关键页）
--   - @design/D42-SLO-容量.md（SLO / 错误预算）
--   - @design/D29-可观测性-合规性-指标.md（RED / USE 指标）
--   - @design/D44-部署拓扑-Hybrid-Site.md（Worker Region / 数据驻留）
--   - database.md（审计字段、命名约定）
--   - security.md（PII 分级、字段加密）
--   - design-constraints.md（AI 安全红线、危险动作约束）
--
-- 子域：
--   1. slo_target          - SLO 目标（可用率/错误预算/延迟指标）
--   2. queue_task          - 队列任务（AI 生成/合规检查/分析运行等）
--   3. worker_status       - Worker 运行状态（CPU/内存/心跳/Region）
--   4. connector_status    - 连接器状态（LLM/AI Provider/MinIO/CAD Worker）
--   5. operations_action   - Operations 主动作（isolate/retry/reconcile/failover 等）
--
-- 安全红线：
--   - 危险动作（ISOLATE/FAILOVER/CANCEL）强制 stepUpToken + impactPreviewAcknowledged
--   - CANCEL 标记为 IRREVERSIBLE，需双人审批
--   - reason 必填，进入审计日志（operations_action.reason + audit_logs 联动）
--   - retry storm 检测（V0 占位：hasRetryStorm=false，V1 接入指标计算）
--   - unknown job 显式标识（V0 占位：通过 QueueTaskStatus 处理，不并入 queued/running）
--   - 跨 Region 操作显示数据驻留约束（queue_task.data_region / worker_status.region）
--
-- PII 分级：
--   - queue_task.payload: L3 业务敏感数据（项目/阶段/资源摘要）
--   - worker_status.current_task_payload: L3 业务敏感数据
--   - operations_action.reason: L2 间接识别信息（含操作人意图）
--   - operations_action.step_up_token_hash: L1 凭证哈希（不存储明文）

CREATE SCHEMA IF NOT EXISTS operations;

-- ============================================================
-- 1. operations.slo_target - SLO 目标（D37.17）
-- ============================================================
CREATE TABLE operations.slo_target (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    availability_target NUMERIC(5,4) NOT NULL,
    availability_current NUMERIC(5,4) NOT NULL,
    error_budget_remaining NUMERIC(8,4) NOT NULL DEFAULT 0,
    request_count_24h BIGINT NOT NULL DEFAULT 0,
    error_count_24h BIGINT NOT NULL DEFAULT 0,
    p95_latency_ms INTEGER NOT NULL DEFAULT 0,
    p99_latency_ms INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'HEALTHY',
    service_name VARCHAR(200),
    window_days INTEGER NOT NULL DEFAULT 28,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_slo_target_tenant_status
    ON operations.slo_target(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_slo_target_tenant_name
    ON operations.slo_target(tenant_id, name)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE operations.slo_target IS 'SLO 目标（D37.17，可用率/错误预算/延迟指标）';
COMMENT ON COLUMN operations.slo_target.availability_target IS '目标可用率（0-1，如 0.999 表示 99.9%）';
COMMENT ON COLUMN operations.slo_target.availability_current IS '当前可用率（0-1，滚动窗口计算）';
COMMENT ON COLUMN operations.slo_target.error_budget_remaining IS '错误预算剩余（百分比，可为负表示已突破）';
COMMENT ON COLUMN operations.slo_target.status IS '健康状态：HEALTHY/WARNING/CRITICAL';
COMMENT ON COLUMN operations.slo_target.window_days IS 'SLO 计算窗口（默认 28 天）';

-- ============================================================
-- 2. operations.queue_task - 队列任务（D37.17）
-- ============================================================
CREATE TABLE operations.queue_task (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
    priority VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
    payload VARCHAR(2000) NOT NULL,
    worker_id UUID,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_sec INTEGER,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    data_region VARCHAR(64),
    last_error VARCHAR(2000),
    project_id VARCHAR(64),
    stage_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_queue_task_tenant_status
    ON operations.queue_task(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_queue_task_tenant_type
    ON operations.queue_task(tenant_id, type)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_queue_task_tenant_priority
    ON operations.queue_task(tenant_id, priority, queued_at)
    WHERE deleted_at IS NULL AND status IN ('QUEUED', 'RUNNING', 'PAUSED');
CREATE INDEX idx_queue_task_tenant_worker
    ON operations.queue_task(tenant_id, worker_id)
    WHERE deleted_at IS NULL AND worker_id IS NOT NULL;
CREATE INDEX idx_queue_task_tenant_project
    ON operations.queue_task(tenant_id, project_id)
    WHERE deleted_at IS NULL AND project_id IS NOT NULL;

COMMENT ON TABLE operations.queue_task IS '队列任务（D37.17，PII: L3 业务敏感数据 payload）';
COMMENT ON COLUMN operations.queue_task.type IS '任务类型：AI_GENERATION/COMPLIANCE_CHECK/ANALYSIS_RUN/PUBLICATION_SEAL/INGEST_PARSE/CLEANUP';
COMMENT ON COLUMN operations.queue_task.status IS '状态：QUEUED/RUNNING/PAUSED/FAILED/COMPLETED';
COMMENT ON COLUMN operations.queue_task.priority IS '优先级：LOW/NORMAL/HIGH/CRITICAL';
COMMENT ON COLUMN operations.queue_task.payload IS '任务负载描述（项目/阶段/资源摘要，PII: L3）';
COMMENT ON COLUMN operations.queue_task.data_region IS '数据驻留 Region（Hybrid-Site 跨境数据传输约束）';
COMMENT ON COLUMN operations.queue_task.max_retries IS '最大重试次数（默认 3，retry storm 检测阈值）';

-- ============================================================
-- 3. operations.worker_status - Worker 运行状态（D37.17）
-- ============================================================
CREATE TABLE operations.worker_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    worker_code VARCHAR(128) NOT NULL,
    type VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'IDLE',
    current_task_id UUID,
    current_task_payload VARCHAR(2000),
    processed_count BIGINT NOT NULL DEFAULT 0,
    failed_count BIGINT NOT NULL DEFAULT 0,
    avg_duration_sec INTEGER NOT NULL DEFAULT 0,
    cpu_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    memory_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    region VARCHAR(64),
    is_customer_site_worker BOOLEAN NOT NULL DEFAULT FALSE,
    is_isolated BOOLEAN NOT NULL DEFAULT FALSE,
    isolated_reason VARCHAR(1000),
    isolated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id),
    CONSTRAINT uq_worker_status_code UNIQUE (tenant_id, worker_code)
);

CREATE INDEX idx_worker_status_tenant_status
    ON operations.worker_status(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_worker_status_tenant_type
    ON operations.worker_status(tenant_id, type)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_worker_status_tenant_region
    ON operations.worker_status(tenant_id, region)
    WHERE deleted_at IS NULL AND region IS NOT NULL;
CREATE INDEX idx_worker_status_heartbeat
    ON operations.worker_status(tenant_id, last_heartbeat)
    WHERE deleted_at IS NULL AND status IN ('RUNNING', 'IDLE');

COMMENT ON TABLE operations.worker_status IS 'Worker 运行状态（D37.17，PII: L3 current_task_payload）';
COMMENT ON COLUMN operations.worker_status.type IS 'Worker 类型：AI/RULE/ANALYSIS/INGEST/PUBLICATION';
COMMENT ON COLUMN operations.worker_status.status IS '运行状态：RUNNING/IDLE/STOPPED/ERROR';
COMMENT ON COLUMN operations.worker_status.region IS 'Worker 所在 Region（Hybrid-Site 部署）';
COMMENT ON COLUMN operations.worker_status.is_customer_site_worker IS '是否为客户站点 Worker（Hybrid-Site 数据驻留约束）';
COMMENT ON COLUMN operations.worker_status.is_isolated IS '是否已隔离（ISOLATE 动作执行后为 true，从调度池移除）';

-- ============================================================
-- 4. operations.connector_status - 连接器状态（D37.17）
-- ============================================================
CREATE TABLE operations.connector_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    connector_code VARCHAR(128) NOT NULL,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    call_count_1h BIGINT NOT NULL DEFAULT 0,
    error_count_1h BIGINT NOT NULL DEFAULT 0,
    avg_latency_ms INTEGER NOT NULL DEFAULT 0,
    license_remaining VARCHAR(200),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_health_check_at TIMESTAMPTZ,
    is_manual_handoff BOOLEAN NOT NULL DEFAULT FALSE,
    endpoint_url VARCHAR(500),
    region VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id),
    CONSTRAINT uq_connector_status_code UNIQUE (tenant_id, connector_code)
);

CREATE INDEX idx_connector_status_tenant_status
    ON operations.connector_status(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_connector_status_tenant_type
    ON operations.connector_status(tenant_id, type)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE operations.connector_status IS '连接器状态（D37.17，对齐 OD-05 外部 AI ManualHandoff 约束）';
COMMENT ON COLUMN operations.connector_status.type IS '连接器类型：LLM/AI_PROVIDER/MINIO/REVIT/RHINO/SKETCHUP';
COMMENT ON COLUMN operations.connector_status.status IS '健康状态：CONNECTED/DEGRADED/DISCONNECTED/UNKNOWN';
COMMENT ON COLUMN operations.connector_status.is_manual_handoff IS '是否为 ManualHandoff（OD-05 外部 AI V1 约束，建筑 AI Provider 强制 true）';
COMMENT ON COLUMN operations.connector_status.license_remaining IS '许可证剩余描述（如 "30 days" / "5000 calls"）';

-- ============================================================
-- 5. operations.operations_action - Operations 主动作（D37.17 §危险动作）
-- ============================================================
CREATE TABLE operations.operations_action (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    operation_id VARCHAR(64) NOT NULL,
    action_type VARCHAR(16) NOT NULL,
    target_type VARCHAR(16) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    risk_level VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
    reason VARCHAR(2000) NOT NULL,
    step_up_token_hash VARCHAR(128),
    impact_preview_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    initiated_by VARCHAR(200) NOT NULL,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    affected_count INTEGER NOT NULL DEFAULT 0,
    audit_trace_id VARCHAR(128) NOT NULL,
    error_message VARCHAR(2000),
    reviewer1 VARCHAR(200),
    reviewer2 VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id),
    CONSTRAINT uq_operations_action_operation_id UNIQUE (operation_id)
);

CREATE INDEX idx_operations_action_tenant_status
    ON operations.operations_action(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_operations_action_tenant_action
    ON operations.operations_action(tenant_id, action_type)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_operations_action_tenant_target
    ON operations.operations_action(tenant_id, target_type, target_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_operations_action_initiated_by
    ON operations.operations_action(tenant_id, initiated_by)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE operations.operations_action IS 'Operations 主动作（D37.17 §危险动作，PII: L2 reason/initiated_by）';
COMMENT ON COLUMN operations.operations_action.action_type IS '动作类型：ISOLATE/RETRY/RECONCILE/FAILOVER/PAUSE/RESUME/CANCEL';
COMMENT ON COLUMN operations.operations_action.target_type IS '目标对象类型：QUEUE_TASK/WORKER/CONNECTOR';
COMMENT ON COLUMN operations.operations_action.risk_level IS '风险等级：LOW/MEDIUM/HIGH/IRREVERSIBLE';
COMMENT ON COLUMN operations.operations_action.status IS '执行状态：QUEUED/RUNNING/COMPLETED/FAILED';
COMMENT ON COLUMN operations.operations_action.reason IS '操作原因（必填，进入审计日志）';
COMMENT ON COLUMN operations.operations_action.step_up_token_hash IS 'Step-up Token 哈希（不存储明文，HIGH/IRREVERSIBLE 必填）';
COMMENT ON COLUMN operations.operations_action.impact_preview_acknowledged IS '影响预览已确认（MEDIUM/HIGH/IRREVERSIBLE 必填 true）';
COMMENT ON COLUMN operations.operations_action.audit_trace_id IS '审计追踪 ID（关联 audit_logs.trace_id）';
COMMENT ON COLUMN operations.operations_action.reviewer1 IS '审批人 1（IRREVERSIBLE 动作双人审批，V0 占位通过）';
COMMENT ON COLUMN operations.operations_action.reviewer2 IS '审批人 2（IRREVERSIBLE 动作双人审批，V0 占位通过）';
