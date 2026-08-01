-- V22__operations_v1_9_dual_approval.sql
-- V1.9 Sprint: IRREVERSIBLE 动作双人审批流程真实实现
--
-- 设计依据：
--   - @design/D37-关键界面-交互状态.md §D37.23（不可逆/合规：专用向导+范围预览+替代方案+二人审批/短语确认+不可逆说明）
--   - @design/D37-关键界面-交互状态.md §D37.17（Operations 中心 §危险动作）
--   - @design/D40-信息-物理安全.md（Step-up 认证 + 职责分离 SoD）
--   - @design/D35-API-事件契约.md（Operations 域危险动作审计）
--   - backend-java.md（Spring Boot 3.4 + JPA + 状态机）
--   - database.md（Flyway 迁移、审计字段、索引命名约定）
--   - security.md（PII 分级、SoD 职责分离、审计日志）
--   - design-constraints.md（V0/V1 渐进式演进策略）
--
-- 变更内容：
--   1. operations.operations_action 表新增 7 个字段：
--      - reviewer1_id:       审批人 1 用户标识（不可与 initiated_by 相同）
--      - reviewer1_at:       审批人 1 批准时间
--      - reviewer1_comment:  审批人 1 意见（必填，进入审计日志）
--      - reviewer2_id:       审批人 2 用户标识（不可与 reviewer1_id 相同）
--      - reviewer2_at:       审批人 2 批准时间
--      - reviewer2_comment:  审批人 2 意见（必填）
--      - dual_approval_status: 双人审批状态枚举
--   2. 新增索引：
--      - idx_operations_action_dual_approval: 双人审批待办查询（tenant_id + dual_approval_status）
--   3. 更新 reviewer1/reviewer2 字段注释（V0 占位 → V1.9 真实填充）
--
-- 状态机（dual_approval_status）：
--   NOT_REQUIRED:        非 IRREVERSIBLE 动作（LOW/MEDIUM/HIGH）默认值
--   PENDING_REVIEW1:     IRREVERSIBLE 动作已发起，等待审批人 1 批准
--   APPROVED_REVIEW1:    审批人 1 已批准，等待审批人 2 批准（中间态，不持久化）
--   REJECTED_REVIEW1:    审批人 1 拒绝（终态）
--   PENDING_REVIEW2:     审批人 1 已批准，等待审批人 2 批准
--   APPROVED:            审批人 2 已批准，动作已执行完成（终态）
--   REJECTED_REVIEW2:    审批人 2 拒绝（终态）
--
-- 安全红线：
--   - 审批人 1 ≠ 发起人（initiated_by）
--   - 审批人 2 ≠ 审批人 1 ≠ 发起人（三人不同）
--   - 审批人 1/2 必须提供 stepUpToken 二次认证
--   - 审批意见必填，进入审计日志
--   - 两次审批间隔 ≥ 5 秒（防误操作，由 Service 层校验）
--
-- 性能考量：
--   - idx_operations_action_dual_approval 索引支持审批待办列表查询
--   - 仅 IRREVERSIBLE 动作进入双人审批流程，其他动作直接执行（dual_approval_status=NOT_REQUIRED）

-- ============================================================
-- 1. operations.operations_action 新增字段（V1.9 双人审批）
-- ============================================================
ALTER TABLE operations.operations_action ADD COLUMN IF NOT EXISTS reviewer1_id VARCHAR(200);
ALTER TABLE operations.operations_action ADD COLUMN IF NOT EXISTS reviewer1_at TIMESTAMPTZ;
ALTER TABLE operations.operations_action ADD COLUMN IF NOT EXISTS reviewer1_comment VARCHAR(1000);
ALTER TABLE operations.operations_action ADD COLUMN IF NOT EXISTS reviewer2_id VARCHAR(200);
ALTER TABLE operations.operations_action ADD COLUMN IF NOT EXISTS reviewer2_at TIMESTAMPTZ;
ALTER TABLE operations.operations_action ADD COLUMN IF NOT EXISTS reviewer2_comment VARCHAR(1000);
ALTER TABLE operations.operations_action ADD COLUMN IF NOT EXISTS dual_approval_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED';

-- ============================================================
-- 2. 新增索引（V1.9）
-- ============================================================

-- 审批待办查询：前端"我的待审批"列表按 tenant_id + dual_approval_status 过滤
-- 索引条件：dual_approval_status IN ('PENDING_REVIEW1','PENDING_REVIEW2') AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_operations_action_dual_approval
    ON operations.operations_action(tenant_id, dual_approval_status, created_at DESC)
    WHERE dual_approval_status IN ('PENDING_REVIEW1', 'PENDING_REVIEW2') AND deleted_at IS NULL;

-- 审批人维度查询：查询某人审批过的所有动作
CREATE INDEX IF NOT EXISTS idx_operations_action_reviewer1
    ON operations.operations_action(tenant_id, reviewer1_id)
    WHERE reviewer1_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_operations_action_reviewer2
    ON operations.operations_action(tenant_id, reviewer2_id)
    WHERE reviewer2_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- 3. 更新字段注释（V1.9）
-- ============================================================
COMMENT ON COLUMN operations.operations_action.reviewer1 IS '审批人 1 标识（V1.9 真实填充，IRREVERSIBLE 动作必填，不可与 initiated_by 相同）';
COMMENT ON COLUMN operations.operations_action.reviewer2 IS '审批人 2 标识（V1.9 真实填充，IRREVERSIBLE 动作必填，不可与 reviewer1/reviewer2/reviewer1_id 相同）';
COMMENT ON COLUMN operations.operations_action.reviewer1_id IS '审批人 1 用户 ID（V1.9 新增，从 x-user-id 头解析，PII: L2）';
COMMENT ON COLUMN operations.operations_action.reviewer1_at IS '审批人 1 批准时间（V1.9 新增）';
COMMENT ON COLUMN operations.operations_action.reviewer1_comment IS '审批人 1 意见（V1.9 新增，必填，进入审计日志，PII: L2）';
COMMENT ON COLUMN operations.operations_action.reviewer2_id IS '审批人 2 用户 ID（V1.9 新增，从 x-user-id 头解析，PII: L2）';
COMMENT ON COLUMN operations.operations_action.reviewer2_at IS '审批人 2 批准时间（V1.9 新增）';
COMMENT ON COLUMN operations.operations_action.reviewer2_comment IS '审批人 2 意见（V1.9 新增，必填，进入审计日志，PII: L2）';
COMMENT ON COLUMN operations.operations_action.dual_approval_status IS '双人审批状态（V1.9 新增）：
  NOT_REQUIRED（非 IRREVERSIBLE 动作默认值）
  PENDING_REVIEW1（IRREVERSIBLE 已发起，待审批人 1）
  REJECTED_REVIEW1（审批人 1 拒绝，终态）
  PENDING_REVIEW2（审批人 1 已批准，待审批人 2）
  APPROVED（审批人 2 已批准，动作已执行，终态）
  REJECTED_REVIEW2（审批人 2 拒绝，终态）';

-- ============================================================
-- 4. 状态机流转注释（V1.9 IRREVERSIBLE 双人审批完整状态机）
-- ============================================================
COMMENT ON TABLE operations.operations_action IS 'Operations 主动作（D37.17 §危险动作 + D37.23 §不可逆/合规，PII: L2 reason/initiated_by/reviewer1_id/reviewer2_id）

IRREVERSIBLE 动作双人审批状态机（V1.9）：
  发起 → PENDING_REVIEW1（不执行实际动作，仅落库审计记录）
  PENDING_REVIEW1 → approveReview1 → PENDING_REVIEW2（审批人 1 批准）
  PENDING_REVIEW1 → rejectReview1 → REJECTED_REVIEW1（审批人 1 拒绝，终态）
  PENDING_REVIEW2 → approveReview2 → APPROVED + 执行实际动作（审批人 2 批准）
  PENDING_REVIEW2 → rejectReview2 → REJECTED_REVIEW2（审批人 2 拒绝，终态）

非 IRREVERSIBLE 动作（LOW/MEDIUM/HIGH）：
  dual_approval_status = NOT_REQUIRED，直接执行实际动作（保持 V0 行为）';
