-- V28__init_test_exceptions.sql
-- 测试例外表 - D45.22 例外治理 / D45.25 TestException API（SIT P0-13.3）
--
-- 设计依据：
--   - @design/D45-测试-验收体系.md §D45.22（缺陷、Flaky 与例外治理）与 §D45.25（TestException API）
--   - database.md（审计字段、命名约定、JSONB 字段、部分索引）
--   - security.md（PII 分级、日志脱敏）
--
-- 验收：
--   - 例外有签署（approvers JSON 必填且含 signedAt 签署时间戳）
--   - Conditional Pass 到期自动撤销（expiry < NOW() 且 ACTIVE → EXPIRED）
--   - 版本升级不自动继承（version_target 绑定，新版本需重新申请）
--
-- PII 分级：
--   - reason / compensation / residual_risk / retest_trigger: L2 间接识别信息（脱敏后写入）
--   - approvers: L1 签署人身份（已脱敏 principalId 引用）

CREATE TABLE governance.test_exception (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
    scope VARCHAR(500) NOT NULL,
    reason VARCHAR(2000) NOT NULL,
    risk VARCHAR(16) NOT NULL,
    compensation VARCHAR(2000) NOT NULL,
    approvers JSONB NOT NULL,
    expiry TIMESTAMPTZ NOT NULL,
    retest_trigger VARCHAR(1000),
    residual_risk VARCHAR(2000),
    version_target VARCHAR(200),
    test_run_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_test_exception_tenant_status
    ON governance.test_exception(tenant_id, status, created_at DESC);
CREATE INDEX idx_test_exception_expiry
    ON governance.test_exception(expiry)
    WHERE status = 'ACTIVE';
CREATE INDEX idx_test_exception_version
    ON governance.test_exception(tenant_id, version_target, status)
    WHERE version_target IS NOT NULL;

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON governance.test_exception
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

COMMENT ON TABLE governance.test_exception IS '测试例外（D45.22 例外治理，SIT P0-13.3）';
COMMENT ON COLUMN governance.test_exception.status IS '状态：PENDING_REVIEW/ACTIVE/EXPIRED/REVOKED/CLOSED';
COMMENT ON COLUMN governance.test_exception.scope IS '适用范围（D45.22 scope，requirementId/testCaseId/releaseId）';
COMMENT ON COLUMN governance.test_exception.reason IS '例外理由（D45.22 reason，脱敏）';
COMMENT ON COLUMN governance.test_exception.risk IS '风险等级：LOW/MEDIUM/HIGH/CRITICAL（D45.22 risk）';
COMMENT ON COLUMN governance.test_exception.compensation IS '补偿控制（D45.22 compensation，缓解措施）';
COMMENT ON COLUMN governance.test_exception.approvers IS '签署人列表（JSON 数组：{principalId,signedAt,comment}[]，例外有签署验收）';
COMMENT ON COLUMN governance.test_exception.expiry IS '到期时间（D45.22 expiry，到期自动撤销）';
COMMENT ON COLUMN governance.test_exception.retest_trigger IS '复测触发条件（D45.22 retest trigger）';
COMMENT ON COLUMN governance.test_exception.residual_risk IS '残余风险（D45.22 residual risk）';
COMMENT ON COLUMN governance.test_exception.version_target IS '绑定版本/Release（版本升级不自动继承）';
COMMENT ON COLUMN governance.test_exception.test_run_id IS '测试运行 ID（对齐 P0-1.2 testRunId 标记机制）';
-- PII 标注
COMMENT ON COLUMN governance.test_exception.approvers IS 'PII: L1 签署人身份（principalId 引用）';
COMMENT ON COLUMN governance.test_exception.reason IS 'PII: L2 间接识别信息（已脱敏）';
COMMENT ON COLUMN governance.test_exception.compensation IS 'PII: L2 间接识别信息（已脱敏）';
COMMENT ON COLUMN governance.test_exception.residual_risk IS 'PII: L2 间接识别信息（已脱敏）';
COMMENT ON COLUMN governance.test_exception.retest_trigger IS 'PII: L2 间接识别信息（已脱敏）';
