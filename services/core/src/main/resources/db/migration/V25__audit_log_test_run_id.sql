-- ============================================================
-- V25: governance.audit_log 添加 test_run_id 字段（P0-1.2 测试数据隔离）
-- 对齐 design/D43-SLO-运营报表.md §测试数据排除规则
--       + design/D44-部署拓扑-Hybrid-Site.md §测试环境分级
--       + .trae/rules/testing.md §Mock 规范
-- 关联 SIT-TASK-TRACKER.md P0-1.2 + BEACON.md A-67
--
-- 设计目标：
--  - CI 流水线注入 testRunId 标记测试产生的审计日志
--  - SLO 报表查询 WHERE test_run_id IS NULL OR test_run_id = 'untracked' 排除测试数据
--  - 单独查询 WHERE test_run_id = 'xxx' 仅查看指定测试运行数据
--  - 测试结束后 DELETE WHERE test_run_id = 'xxx' 清理测试数据
--
-- 字段约束：
--  - nullable：历史数据无 testRunId，保持 NULL
--  - VARCHAR(64)：与 packages/shared TEST_RUN_ID_MAX_LENGTH 一致
--  - 部分索引 WHERE test_run_id IS NOT NULL：仅索引已标记数据，提升查询效率
-- ============================================================

-- 1. governance.audit_log 新增 test_run_id 字段
ALTER TABLE governance.audit_log
    ADD COLUMN IF NOT EXISTS test_run_id VARCHAR(64);

-- 2. 部分索引：仅索引已标记的测试数据（test_run_id IS NOT NULL）
--    用途：CI 流水线清理测试数据 DELETE WHERE test_run_id = ? 时使用
--    用途：SLO 报表排除测试数据 WHERE test_run_id IS NULL OR test_run_id = 'untracked'
--    部分索引避免对历史数据（NULL）建索引，减少存储与写入开销
CREATE INDEX IF NOT EXISTS idx_audit_log_test_run_id
    ON governance.audit_log (test_run_id)
    WHERE test_run_id IS NOT NULL;

-- 3. 注释（PostgreSQL COMMENT ON COLUMN）
COMMENT ON COLUMN governance.audit_log.test_run_id IS
    '测试运行 ID（P0-1.2）：CI 流水线注入标识，标记测试产生的审计日志；NULL 表示未标记（生产或本地开发）；SLO 报表查询应排除已标记数据';

-- ============================================================
-- 回滚说明（如需要）：
--   DROP INDEX IF EXISTS governance.idx_audit_log_test_run_id;
--   ALTER TABLE governance.audit_log DROP COLUMN IF EXISTS test_run_id;
-- ============================================================
