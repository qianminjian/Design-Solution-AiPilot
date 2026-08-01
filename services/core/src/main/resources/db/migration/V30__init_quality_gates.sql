-- V30__init_quality_gates.sql
-- 质量门禁表 - D45.23 质量门禁与验收签署（SIT P0-13.4）
--
-- 设计依据：
--   - @design/D45-测试-验收体系.md §D45.23（6 级 Gate 必要证据与签署角色）
--   - database.md（审计字段、命名约定、JSONB 字段）
--
-- 验收：
--   - 每 Gate 签署角色落实（signer_role 必填）
--   - AI 不代签（ai_signed 恒 false，签署角色拒绝 AI/AGENT/SYSTEM）
--   - 任何签署均是责任人的决定，平台/AI 只聚合证据、检查完整性和记录签名
--
-- PII 分级：
--   - checks: L3 敏感业务数据（检查项证据引用）

CREATE TABLE governance.quality_gate (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    gate_level VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED',
    version_target VARCHAR(200),
    checks JSONB NOT NULL,
    signer_role VARCHAR(100),
    signed_by UUID,
    signed_at TIMESTAMPTZ,
    decision VARCHAR(16),
    ai_signed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_quality_gate_tenant_status
    ON governance.quality_gate(tenant_id, status, created_at DESC);
CREATE INDEX idx_quality_gate_level
    ON governance.quality_gate(tenant_id, gate_level, version_target)
    WHERE version_target IS NOT NULL;

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON governance.quality_gate
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

COMMENT ON TABLE governance.quality_gate IS '质量门禁（D45.23 质量门禁与验收签署，SIT P0-13.4）';
COMMENT ON COLUMN governance.quality_gate.gate_level IS '门禁等级：PR_MERGE/INTEGRATION/RELEASE_CANDIDATE/PREPROD/PILOT_UAT/PRODUCTION_PROMOTION';
COMMENT ON COLUMN governance.quality_gate.status IS '状态：NOT_STARTED/IN_PROGRESS/PASSED/FAILED/BLOCKED';
COMMENT ON COLUMN governance.quality_gate.version_target IS '绑定版本/Release';
COMMENT ON COLUMN governance.quality_gate.checks IS '检查项（JSON 数组：{name,requiredEvidence,result}[]，D45.23 必要证据）';
COMMENT ON COLUMN governance.quality_gate.signer_role IS '签署角色（D45.23 每 Gate 签署角色，如 Developer+Reviewer / Release Authority）';
COMMENT ON COLUMN governance.quality_gate.signed_by IS '签署人（Principal ID）';
COMMENT ON COLUMN governance.quality_gate.signed_at IS '签署时间';
COMMENT ON COLUMN governance.quality_gate.decision IS '签署决定：PASS/FAIL/Go/No-Go';
COMMENT ON COLUMN governance.quality_gate.ai_signed IS 'AI 是否代签（恒 false：AI 不代签红线）';
-- PII 标注
COMMENT ON COLUMN governance.quality_gate.checks IS 'PII: L3 敏感业务数据（检查项证据引用）';
COMMENT ON COLUMN governance.quality_gate.signer_role IS 'PII: L1 签署人身份（角色）';
COMMENT ON COLUMN governance.quality_gate.signed_by IS 'PII: L1 签署人身份（Principal ID）';
