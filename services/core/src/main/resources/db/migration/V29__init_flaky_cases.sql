-- V29__init_flaky_cases.sql
-- Flaky Case 表 - D45.22 缺陷、Flaky 与例外治理（SIT P0-13.2）
--
-- 设计依据：
--   - @design/D45-测试-验收体系.md §D45.22（Flaky 检测机制 + 隔离 + 修复）
--   - database.md（审计字段、命名约定、部分索引）
--
-- 检测机制（D45.22）：
--   - Flaky Case 连续重复不稳定即隔离（连续 3 次结果翻转 → FLAKY）
--   - 对应 Requirement 变为 Coverage Gap（isolate 关联）
--   - 保留替代确定性 TestCase（replacement_case_id 非空）才可不阻断发布
--   - 修复必须有最小回归样本和根因分类（resolve 必填）
--
-- PII 分级：
--   - root_cause / regression_sample: L3 敏感业务数据

CREATE TABLE governance.flaky_case (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'TRACKED',
    test_case_id VARCHAR(200) NOT NULL,
    requirement_id VARCHAR(200) NOT NULL,
    run_count INTEGER NOT NULL DEFAULT 0,
    instability_count INTEGER NOT NULL DEFAULT 0,
    consecutive_unstable INTEGER NOT NULL DEFAULT 0,
    last_result BOOLEAN,
    root_cause VARCHAR(500),
    regression_sample VARCHAR(1000),
    replacement_case_id VARCHAR(200),
    test_run_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_flaky_case_tenant_test_case
    ON governance.flaky_case(tenant_id, test_case_id);
CREATE INDEX idx_flaky_case_tenant_status
    ON governance.flaky_case(tenant_id, status, created_at DESC);
CREATE INDEX idx_flaky_case_requirement
    ON governance.flaky_case(tenant_id, requirement_id)
    WHERE status IN ('FLAKY', 'ISOLATED');

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON governance.flaky_case
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

COMMENT ON TABLE governance.flaky_case IS 'Flaky Case（D45.22 Flaky 治理，SIT P0-13.2）';
COMMENT ON COLUMN governance.flaky_case.status IS '状态：TRACKED/FLAKY/ISOLATED/RESOLVED';
COMMENT ON COLUMN governance.flaky_case.test_case_id IS '测试用例 ID（唯一标识）';
COMMENT ON COLUMN governance.flaky_case.requirement_id IS '对应 Requirement ID（双向追踪，隔离后变 Coverage Gap）';
COMMENT ON COLUMN governance.flaky_case.run_count IS '总运行次数';
COMMENT ON COLUMN governance.flaky_case.instability_count IS '不稳定次数（结果翻转计数）';
COMMENT ON COLUMN governance.flaky_case.consecutive_unstable IS '连续不稳定次数（连续 3 次触发隔离）';
COMMENT ON COLUMN governance.flaky_case.last_result IS '上次运行结果（用于翻转检测）';
COMMENT ON COLUMN governance.flaky_case.root_cause IS '根因分类（resolve 必填，如 ENV_DEPENDENT/TIMING/DATA_RACE/ORDER_DEPENDENT）';
COMMENT ON COLUMN governance.flaky_case.regression_sample IS '最小回归样本引用（resolve 必填，如 testCaseId@commit）';
COMMENT ON COLUMN governance.flaky_case.replacement_case_id IS '替代确定性 TestCase ID（isolate 时提供则不阻断发布）';
COMMENT ON COLUMN governance.flaky_case.test_run_id IS '测试运行 ID（对齐 P0-1.2 testRunId 标记机制）';
-- PII 标注
COMMENT ON COLUMN governance.flaky_case.root_cause IS 'PII: L3 敏感业务数据';
COMMENT ON COLUMN governance.flaky_case.regression_sample IS 'PII: L3 敏感业务数据';
