-- V27__extend_compliance_findings.sql
-- 扩展合规发现表 - D45.22 缺陷治理 / D45.25 Finding API（SIT P0-13.1）
--
-- 设计依据：
--   - @design/D45-测试-验收体系.md §D45.22（缺陷治理 Finding 字段集）与 §D45.25（Finding API）
--   - database.md（审计字段、命名约定、高风险变更流程）
--   - security.md（PII 分级、日志脱敏）
--
-- 新增字段对齐路线图：
--   severity/category/repro/affected requirement/artifact/root state/owner/SLA/fix/verification
--
-- PII 分级：
--   - repro / fix / verification / note: L2 间接识别信息（必须脱敏后写入）
--   - affected_requirement / artifact: L3 敏感业务数据

ALTER TABLE compliance.compliance_findings
    ADD COLUMN IF NOT EXISTS category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS repro TEXT,
    ADD COLUMN IF NOT EXISTS affected_requirement VARCHAR(500),
    ADD COLUMN IF NOT EXISTS artifact VARCHAR(500),
    ADD COLUMN IF NOT EXISTS root_state VARCHAR(32) NOT NULL DEFAULT 'IDENTIFIED',
    ADD COLUMN IF NOT EXISTS owner UUID,
    ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fix TEXT,
    ADD COLUMN IF NOT EXISTS verification TEXT,
    ADD COLUMN IF NOT EXISTS verified_by UUID,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_findings_tenant_severity
    ON compliance.compliance_findings(tenant_id, severity, status);
CREATE INDEX IF NOT EXISTS idx_findings_owner
    ON compliance.compliance_findings(tenant_id, owner)
    WHERE owner IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_sla
    ON compliance.compliance_findings(tenant_id, sla_due_at)
    WHERE sla_due_at IS NOT NULL AND status NOT IN ('CLOSED', 'VERIFIED');

COMMENT ON COLUMN compliance.compliance_findings.category IS '缺陷类别（D45.22 category，如 SAFETY/STRUCTURE/COMPLIANCE/QUALITY）';
COMMENT ON COLUMN compliance.compliance_findings.repro IS '复现步骤（D45.22 repro，脱敏不含敏感内容）';
COMMENT ON COLUMN compliance.compliance_findings.affected_requirement IS '影响的需求/规范（D45.22 affected requirement，双向追踪）';
COMMENT ON COLUMN compliance.compliance_findings.artifact IS '关联工件（D45.22 artifact）';
COMMENT ON COLUMN compliance.compliance_findings.root_state IS '根因状态：IDENTIFIED/ANALYZING/FIXED/REGRESSED';
COMMENT ON COLUMN compliance.compliance_findings.owner IS '责任人（D45.22 owner）';
COMMENT ON COLUMN compliance.compliance_findings.sla_due_at IS 'SLA 截止时间（D45.22 SLA）';
COMMENT ON COLUMN compliance.compliance_findings.fix IS '修复方案（D45.22 fix）';
COMMENT ON COLUMN compliance.compliance_findings.verification IS '复测结果（D45.22 verification，独立复测证据）';
COMMENT ON COLUMN compliance.compliance_findings.verified_by IS '复测人（CRITICAL 必须与 owner 不同，独立复测）';
COMMENT ON COLUMN compliance.compliance_findings.verified_at IS '复测时间';
-- PII 标注
COMMENT ON COLUMN compliance.compliance_findings.repro IS 'PII: L2 间接识别信息（已脱敏）';
COMMENT ON COLUMN compliance.compliance_findings.fix IS 'PII: L2 间接识别信息（已脱敏）';
COMMENT ON COLUMN compliance.compliance_findings.verification IS 'PII: L2 间接识别信息（已脱敏）';
COMMENT ON COLUMN compliance.compliance_findings.affected_requirement IS 'PII: L3 敏感业务数据';
COMMENT ON COLUMN compliance.compliance_findings.artifact IS 'PII: L3 敏感业务数据';
