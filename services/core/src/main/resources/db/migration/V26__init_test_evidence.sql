-- V26__init_test_evidence.sql
-- 测试证据表 - D45.10 TestEvidence（P0-1.4 测试报告与证据存储）
--
-- 设计依据：
--   - @design/D45-测试-验收体系.md §D45.10（TestEvidence Manifest）
--   - @design/D41-安全-加固.md（WORM / 签名 / TSA）
--   - database.md（审计字段、命名约定）
--   - security.md（PII 分级、数据生命周期）
--
-- 证据链语义：只追加（Write Once Read Many），不提供修改/删除。
-- 不创建 deleted_at/deleted_by 字段（与 audit_log 一致，证据不可删除）。
--
-- PII 分级：
--   - test_evidence.hash / object_uri: L4 设计成果哈希与定位
--   - test_evidence.raw_summary: L2 间接识别信息（必须脱敏后入库）

CREATE TABLE governance.test_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    evidence_type VARCHAR(32) NOT NULL,
    object_uri VARCHAR(512) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    tool VARCHAR(100) NOT NULL,
    version VARCHAR(32) NOT NULL,
    raw_summary VARCHAR(512) NOT NULL,
    retention VARCHAR(32) NOT NULL,
    classification VARCHAR(8) NOT NULL,
    signature_algorithm VARCHAR(32),
    signature_value VARCHAR(1024),
    object_id VARCHAR(200),
    object_type VARCHAR(100),
    test_run_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_test_evidence_tenant_type
    ON governance.test_evidence(tenant_id, evidence_type, created_at DESC);
CREATE INDEX idx_test_evidence_test_run
    ON governance.test_evidence(test_run_id, created_at DESC)
    WHERE test_run_id IS NOT NULL;
CREATE INDEX idx_test_evidence_hash
    ON governance.test_evidence(hash);
CREATE INDEX idx_test_evidence_object
    ON governance.test_evidence(tenant_id, object_type, object_id)
    WHERE object_id IS NOT NULL;

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON governance.test_evidence
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

COMMENT ON TABLE governance.test_evidence IS '测试证据（D45.10 TestEvidence，P0-1.4，只追加）';
COMMENT ON COLUMN governance.test_evidence.evidence_type IS '证据类型：UNIT/INTEGRATION/E2E/PERFORMANCE/SECURITY/ACCEPTANCE/CONTRACT';
COMMENT ON COLUMN governance.test_evidence.object_uri IS '对象存储 URI（S3/MinIO）';
COMMENT ON COLUMN governance.test_evidence.hash IS '内容哈希（SHA-256 hex，证据可校验）';
COMMENT ON COLUMN governance.test_evidence.tool IS '生成工具（如 mvn-surefire / bff-upload）';
COMMENT ON COLUMN governance.test_evidence.version IS '工具版本（语义化 1.0.0）';
COMMENT ON COLUMN governance.test_evidence.raw_summary IS '原始摘要（脱敏，不含敏感内容）';
COMMENT ON COLUMN governance.test_evidence.retention IS '保留策略：PROJECT_LIFETIME/LEGAL_HOLD/DAYS_30/DAYS_90/YEAR_1';
COMMENT ON COLUMN governance.test_evidence.classification IS '数据分级：L1/L2/L3/L4/L5（对齐 security.md §8）';
COMMENT ON COLUMN governance.test_evidence.signature_algorithm IS '签名算法：HMAC-SHA256/RSA-SHA256/RFC3161-TSA';
COMMENT ON COLUMN governance.test_evidence.signature_value IS '签名值（Base64）';
COMMENT ON COLUMN governance.test_evidence.object_id IS '关联对象 ID（如 releaseId / testRunId）';
COMMENT ON COLUMN governance.test_evidence.object_type IS '关联对象类型（如 release / project / test_run）';
COMMENT ON COLUMN governance.test_evidence.test_run_id IS '测试运行 ID（对齐 P0-1.2 testRunId 标记机制）';
-- PII 标注
COMMENT ON COLUMN governance.test_evidence.hash IS 'PII: L4 设计成果哈希';
COMMENT ON COLUMN governance.test_evidence.object_uri IS 'PII: L4 设计文件定位';
COMMENT ON COLUMN governance.test_evidence.raw_summary IS 'PII: L2 间接识别信息（已脱敏）';
