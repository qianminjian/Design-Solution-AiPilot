-- V17__init_governance.sql
-- 治理域 - D37.17 治理中心 7 个子域数据库 Schema
--
-- 设计依据：
--   - @design/D37-关键界面-交互状态.md（D37.17 治理中心）
--   - @design/D34-数据-数据库.md §D34.5（聚合根）
--   - database.md（审计字段、命名约定）
--   - security.md（PII 分级、字段加密）
--
-- 子域：
--   1. access_grant     - 访问授权治理（含 Step-Up、Legal Hold、有效期）
--   2. releases         - AI/规则集发布生命周期
--   3. data_asset       - 数据资产清单与质量评分
--   4. audit_log        - 审计日志（自动写入，只追加）
--   5. evidence_package - 证据包封存与验证
--   6. evidence_item    - 证据项（证据包子表）
--   7. backup_point     - 备份点记录
--   8. restore_drill    - 灾备演练记录
--
-- PII 分级：
--   - access_grant.principal_email / owner_email: L1 直接识别信息
--   - access_grant.reason: L2 间接识别信息
--   - audit_log.details: L2 间接识别信息（已 mask 处理）
--   - audit_log.ip_address / user_agent: L1 直接识别信息
--   - evidence_package.hash / evidence_item.hash: L4 设计成果哈希

CREATE SCHEMA IF NOT EXISTS governance;

-- ============================================================
-- 1. governance.access_grant - 访问授权治理（D37.17 Access Review）
-- ============================================================
CREATE TABLE governance.access_grant (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    principal_name VARCHAR(200) NOT NULL,
    principal_email VARCHAR(320) NOT NULL,
    resource VARCHAR(500) NOT NULL,
    permission VARCHAR(200) NOT NULL,
    risk_level VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
    granted_by VARCHAR(200) NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,
    owner VARCHAR(200) NOT NULL,
    owner_email VARCHAR(320) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    requires_step_up BOOLEAN NOT NULL DEFAULT FALSE,
    has_legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    propagation_dependents JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_access_grant_tenant_status
    ON governance.access_grant(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_access_grant_principal
    ON governance.access_grant(tenant_id, principal_email, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_access_grant_resource
    ON governance.access_grant(tenant_id, resource, permission)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_access_grant_expires
    ON governance.access_grant(expires_at)
    WHERE status = 'ACTIVE' AND deleted_at IS NULL;
CREATE INDEX idx_access_grant_risk
    ON governance.access_grant(tenant_id, risk_level, status)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE governance.access_grant IS '访问授权治理（D37.17 Access Review）';
COMMENT ON COLUMN governance.access_grant.type IS '授权类型：MEMBER/EXTERNAL/SERVICE/BREAKGLASS';
COMMENT ON COLUMN governance.access_grant.risk_level IS '风险等级：LOW/MEDIUM/HIGH/CRITICAL';
COMMENT ON COLUMN governance.access_grant.status IS '状态：ACTIVE/PENDING_REVIEW/SHORTENED/REVOKED/EXPIRED';
COMMENT ON COLUMN governance.access_grant.requires_step_up IS '是否需要 Step-Up 认证';
COMMENT ON COLUMN governance.access_grant.has_legal_hold IS '是否被 Legal Hold（法律保留）';
COMMENT ON COLUMN governance.access_grant.propagation_dependents IS '传播依赖（下游资源 ID 列表，JSON 数组）';
-- PII 标注
COMMENT ON COLUMN governance.access_grant.principal_email IS 'PII: L1 手机号/邮箱';
COMMENT ON COLUMN governance.access_grant.owner_email IS 'PII: L1 手机号/邮箱';
COMMENT ON COLUMN governance.access_grant.reason IS 'PII: L2 间接识别信息';

-- ============================================================
-- 2. governance.releases - AI/规则集发布生命周期（D37.17 AI/Rule Release）
-- ============================================================
CREATE TABLE governance.releases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(32) NOT NULL,
    version VARCHAR(64) NOT NULL,
    previous_version VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    release_manager VARCHAR(200) NOT NULL,
    promoted_at TIMESTAMPTZ,
    eval_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    eval_slices INTEGER NOT NULL DEFAULT 0,
    redteam_status VARCHAR(16) NOT NULL DEFAULT 'NOT_RUN',
    consumer_count INTEGER NOT NULL DEFAULT 0,
    canary_percent INTEGER NOT NULL DEFAULT 0,
    metrics_drift VARCHAR(16) NOT NULL DEFAULT 'NONE',
    has_eval_gap BOOLEAN NOT NULL DEFAULT FALSE,
    has_old_consumer BOOLEAN NOT NULL DEFAULT FALSE,
    description VARCHAR(2000) NOT NULL DEFAULT '',
    diff_added INTEGER NOT NULL DEFAULT 0,
    diff_modified INTEGER NOT NULL DEFAULT 0,
    diff_removed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE UNIQUE INDEX idx_releases_name_version
    ON governance.releases(tenant_id, name, version)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_releases_status
    ON governance.releases(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_releases_type
    ON governance.releases(tenant_id, type, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_releases_promoted
    ON governance.releases(tenant_id, promoted_at DESC)
    WHERE promoted_at IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE governance.releases IS 'AI/规则集发布生命周期（D37.17 AI/Rule Release）';
COMMENT ON COLUMN governance.releases.type IS '发布类型：LLM/RULESET/AI_PROVIDER';
COMMENT ON COLUMN governance.releases.status IS '发布状态：DRAFT/IN_REVIEW/CANARY/PROMOTED/ROLLBACK/SUSPENDED';
COMMENT ON COLUMN governance.releases.redteam_status IS '红队测试状态：NOT_RUN/PASSED/FAILED/BLOCKED';
COMMENT ON COLUMN governance.releases.metrics_drift IS '指标漂移：NONE/LOW/MEDIUM/HIGH';
COMMENT ON COLUMN governance.releases.has_eval_gap IS '是否存在评估覆盖缺口（true 禁止 promote）';
COMMENT ON COLUMN governance.releases.diff_added IS 'diff: 新增项数';
COMMENT ON COLUMN governance.releases.diff_modified IS 'diff: 修改项数';
COMMENT ON COLUMN governance.releases.diff_removed IS 'diff: 删除项数';

-- ============================================================
-- 3. governance.data_asset - 数据资产清单（D37.17 Data Governance）
-- ============================================================
CREATE TABLE governance.data_asset (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    name VARCHAR(200) NOT NULL,
    domain VARCHAR(100) NOT NULL,
    owner VARCHAR(200) NOT NULL,
    owner_email VARCHAR(320) NOT NULL,
    classification VARCHAR(8) NOT NULL,
    retention_years INTEGER NOT NULL DEFAULT 7,
    retention_legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    retention_disposal_date TIMESTAMPTZ NOT NULL,
    quality_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    quality_issues INTEGER NOT NULL DEFAULT 0,
    lineage_coverage DOUBLE PRECISION NOT NULL DEFAULT 0,
    storage_locations JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'DISCOVERED',
    last_modified TIMESTAMPTZ NOT NULL,
    description VARCHAR(2000) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_data_asset_tenant_status
    ON governance.data_asset(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_data_asset_domain
    ON governance.data_asset(tenant_id, domain, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_data_asset_owner
    ON governance.data_asset(tenant_id, owner, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_data_asset_classification
    ON governance.data_asset(tenant_id, classification, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_data_asset_disposal
    ON governance.data_asset(retention_disposal_date)
    WHERE retention_legal_hold = FALSE AND deleted_at IS NULL;

COMMENT ON TABLE governance.data_asset IS '数据资产清单（D37.17 Data Governance）';
COMMENT ON COLUMN governance.data_asset.type IS '资产类型：DATASET/MODEL/ARTIFACT/DOCUMENT/PIPELINE';
COMMENT ON COLUMN governance.data_asset.classification IS '数据分级：L1/L2/L3/L4/L5';
COMMENT ON COLUMN governance.data_asset.status IS '资产状态：DISCOVERED/CLASSIFIED/PROTECTED/ARCHIVED/DELETED';
COMMENT ON COLUMN governance.data_asset.retention_years IS '保留年限（必须为正）';
COMMENT ON COLUMN governance.data_asset.retention_legal_hold IS '是否处于法律保留';
COMMENT ON COLUMN governance.data_asset.retention_disposal_date IS '处置日期（到期后可删除）';
COMMENT ON COLUMN governance.data_asset.quality_score IS '质量评分 0-1';
COMMENT ON COLUMN governance.data_asset.lineage_coverage IS '血缘覆盖率 0-1';
COMMENT ON COLUMN governance.data_asset.storage_locations IS '存储位置（JSON 数组）';
-- PII 标注
COMMENT ON COLUMN governance.data_asset.owner_email IS 'PII: L1 手机号/邮箱';

-- ============================================================
-- 4. governance.audit_log - 审计日志（D37.17 Audit/Evidence）
-- ============================================================
-- 注意：审计日志只追加，不更新，row_version 永远为 1
-- 不创建 deleted_at/deleted_by 字段（审计日志不可删除）
CREATE TABLE governance.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    actor_id VARCHAR(200) NOT NULL,
    actor_name VARCHAR(200) NOT NULL,
    actor_type VARCHAR(16) NOT NULL,
    action VARCHAR(200) NOT NULL,
    category VARCHAR(32) NOT NULL,
    object_type VARCHAR(100) NOT NULL,
    object_id VARCHAR(200) NOT NULL,
    object_name VARCHAR(200) NOT NULL,
    trace_id VARCHAR(64) NOT NULL,
    result VARCHAR(16) NOT NULL,
    risk_level VARCHAR(16) NOT NULL,
    masked BOOLEAN NOT NULL DEFAULT TRUE,
    ip_address VARCHAR(64) NOT NULL,
    user_agent VARCHAR(500) NOT NULL,
    details VARCHAR(4000) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_audit_log_tenant_time
    ON governance.audit_log(tenant_id, timestamp DESC);
CREATE INDEX idx_audit_log_actor
    ON governance.audit_log(tenant_id, actor_id, timestamp DESC);
CREATE INDEX idx_audit_log_category
    ON governance.audit_log(tenant_id, category, timestamp DESC);
CREATE INDEX idx_audit_log_risk
    ON governance.audit_log(tenant_id, risk_level, timestamp DESC);
CREATE INDEX idx_audit_log_result
    ON governance.audit_log(tenant_id, result, timestamp DESC);
CREATE INDEX idx_audit_log_object
    ON governance.audit_log(tenant_id, object_type, object_id, timestamp DESC);
CREATE INDEX idx_audit_log_trace
    ON governance.audit_log(trace_id)
    WHERE trace_id IS NOT NULL;
CREATE INDEX idx_audit_log_action
    ON governance.audit_log(tenant_id, action, timestamp DESC);

COMMENT ON TABLE governance.audit_log IS '审计日志（D37.17 Audit/Evidence，只追加）';
COMMENT ON COLUMN governance.audit_log.timestamp IS '事件发生时间（业务字段）';
COMMENT ON COLUMN governance.audit_log.actor_id IS '执行者 ID（用户/服务/系统）';
COMMENT ON COLUMN governance.audit_log.actor_type IS '执行者类型：USER/SERVICE/SYSTEM/BREAKGLASS';
COMMENT ON COLUMN governance.audit_log.action IS '操作名称（如 project.create / release.promote）';
COMMENT ON COLUMN governance.audit_log.category IS '操作类别：AUTH/DATA/GOVERNANCE/AI/PUBLICATION/ADMIN';
COMMENT ON COLUMN governance.audit_log.result IS '执行结果：SUCCESS/FAILURE/DENIED/ERROR';
COMMENT ON COLUMN governance.audit_log.risk_level IS '风险等级：LOW/MEDIUM/HIGH/CRITICAL';
COMMENT ON COLUMN governance.audit_log.masked IS '是否脱敏（敏感字段已 mask 处理）';
-- PII 标注
COMMENT ON COLUMN governance.audit_log.ip_address IS 'PII: L1 直接识别信息（已 mask）';
COMMENT ON COLUMN governance.audit_log.user_agent IS 'PII: L1 直接识别信息（已 mask）';
COMMENT ON COLUMN governance.audit_log.details IS 'PII: L2 间接识别信息（已 mask）';

-- ============================================================
-- 5. governance.evidence_package - 证据包封存（D37.17 Audit/Evidence）
-- ============================================================
CREATE TABLE governance.evidence_package (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    object_id VARCHAR(200) NOT NULL,
    object_type VARCHAR(100) NOT NULL,
    sealed_by VARCHAR(200),
    sealed_at TIMESTAMPTZ,
    verified_by VARCHAR(200),
    verified_at TIMESTAMPTZ,
    hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_evidence_package_tenant_status
    ON governance.evidence_package(tenant_id, status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_evidence_package_object
    ON governance.evidence_package(tenant_id, object_type, object_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_evidence_package_sealed
    ON governance.evidence_package(tenant_id, sealed_at DESC)
    WHERE sealed_at IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE governance.evidence_package IS '证据包封存（D37.17 Audit/Evidence）';
COMMENT ON COLUMN governance.evidence_package.status IS '状态：OPEN/SEALED/VERIFIED/REJECTED';
COMMENT ON COLUMN governance.evidence_package.sealed_by IS '封存人（签章人）';
COMMENT ON COLUMN governance.evidence_package.hash IS '整体哈希（所有 items 哈希的聚合）';
-- PII 标注
COMMENT ON COLUMN governance.evidence_package.hash IS 'PII: L4 设计成果哈希';

-- ============================================================
-- 6. governance.evidence_item - 证据项（证据包子表）
-- ============================================================
CREATE TABLE governance.evidence_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID NOT NULL REFERENCES governance.evidence_package(id) ON DELETE CASCADE,
    source VARCHAR(500) NOT NULL,
    revision VARCHAR(64),
    toolchain VARCHAR(200),
    hash VARCHAR(128) NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_item_package
    ON governance.evidence_item(package_id, captured_at DESC);
CREATE INDEX idx_evidence_item_hash
    ON governance.evidence_item(hash);

COMMENT ON TABLE governance.evidence_item IS '证据项（证据包子表）';
COMMENT ON COLUMN governance.evidence_item.source IS '来源（如 S3 key / 数据库表 / URL）';
COMMENT ON COLUMN governance.evidence_item.toolchain IS '工具链（如 Revit 2024）';
COMMENT ON COLUMN governance.evidence_item.hash IS 'SHA-256 哈希，用于完整性校验';
-- PII 标注
COMMENT ON COLUMN governance.evidence_item.hash IS 'PII: L4 设计成果哈希';

-- ============================================================
-- 7. governance.backup_point - 备份点（D37.17 Backup/Restore）
-- ============================================================
CREATE TABLE governance.backup_point (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    scope VARCHAR(32) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_sec INTEGER,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    object_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'IN_PROGRESS',
    actual_rpo_min INTEGER NOT NULL DEFAULT 0,
    storage_location VARCHAR(500) NOT NULL,
    hash VARCHAR(128) NOT NULL,
    triggered_by VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_backup_point_tenant_status
    ON governance.backup_point(tenant_id, status, started_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_backup_point_type
    ON governance.backup_point(tenant_id, type, scope, started_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_backup_point_triggered
    ON governance.backup_point(tenant_id, triggered_by, started_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE governance.backup_point IS '备份点（D37.17 Backup/Restore）';
COMMENT ON COLUMN governance.backup_point.type IS '备份类型：FULL/INCREMENTAL/DIFFERENTIAL';
COMMENT ON COLUMN governance.backup_point.scope IS '备份范围：DATABASE/STORAGE/METADATA/CONFIG';
COMMENT ON COLUMN governance.backup_point.status IS '状态：IN_PROGRESS/COMPLETED/FAILED/VERIFIED';
COMMENT ON COLUMN governance.backup_point.actual_rpo_min IS '实际 RPO（分钟）';
COMMENT ON COLUMN governance.backup_point.hash IS '备份内容哈希';
-- PII 标注
COMMENT ON COLUMN governance.backup_point.hash IS 'PII: L4 设计成果哈希';

-- ============================================================
-- 8. governance.restore_drill - 灾备演练（D37.17 Backup/Restore）
-- ============================================================
CREATE TABLE governance.restore_drill (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    backup_id UUID NOT NULL REFERENCES governance.backup_point(id) ON DELETE CASCADE,
    target VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    actual_rto_min INTEGER,
    actual_rpo_min INTEGER,
    verifier VARCHAR(200) NOT NULL,
    report_url VARCHAR(500),
    passed BOOLEAN,
    notes VARCHAR(2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES iam.principal(id)
);

CREATE INDEX idx_restore_drill_tenant_status
    ON governance.restore_drill(tenant_id, status, started_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_restore_drill_backup
    ON governance.restore_drill(backup_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_restore_drill_verifier
    ON governance.restore_drill(tenant_id, verifier, started_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE governance.restore_drill IS '灾备演练（D37.17 Backup/Restore）';
COMMENT ON COLUMN governance.restore_drill.target IS '恢复目标：ISOLATED_ENV/PRODUCTION';
COMMENT ON COLUMN governance.restore_drill.status IS '状态：SCHEDULED/IN_PROGRESS/COMPLETED/FAILED/CANCELLED';
COMMENT ON COLUMN governance.restore_drill.actual_rto_min IS '实际 RTO（分钟）';
COMMENT ON COLUMN governance.restore_drill.actual_rpo_min IS '实际 RPO（分钟）';
COMMENT ON COLUMN governance.restore_drill.passed IS '是否通过';

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
          AND table_schema = 'governance'
          AND table_name IN ('access_grant', 'releases', 'data_asset', 'audit_log',
                             'evidence_package', 'backup_point', 'restore_drill')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_timestamp ON governance.%I', t);
        EXECUTE format('CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON governance.%I
            FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp()', t);
    END LOOP;
END $$;
