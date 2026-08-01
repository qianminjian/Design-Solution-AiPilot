-- V21__operations_v1_6_scheduler_dead_letter.sql
-- V1.6 Sprint: Worker Scheduler 自动调度重试 + DeadLetterQueue 处理器
--
-- 设计依据：
--   - @design/D37-关键界面-交互状态.md §D37.17（P11 Operations 中心 §Worker 调度 §死信队列）
--   - backend-java.md（Spring Boot 3.4 + JPA + @Scheduled）
--   - database.md（Flyway 迁移、审计字段、索引命名约定）
--   - security.md（PII 分级、字段加密、AI 安全红线）
--   - design-constraints.md（V0/V1 渐进式演进策略）
--
-- 变更内容：
--   1. operations.queue_task 表新增 4 个字段：
--      - next_retry_at: 下次重试时间（RETRY_SCHEDULED 状态）
--      - retry_reason: 重试原因（最近失败原因摘要，500 字符）
--      - dead_lettered_at: 进入死信队列时间（DEAD_LETTER 状态）
--      - dead_letter_reason: 进入死信队列原因（500 字符）
--   2. 新增 2 个索引：
--      - idx_queue_task_retry_schedule: 扫描到期重试任务（status=RETRY_SCHEDULED + next_retry_at）
--      - idx_queue_task_dead_letter: 死信队列查询（tenant_id + dead_lettered_at）
--   3. 更新 status 字段注释，新增 RETRY_SCHEDULED / DEAD_LETTER 状态枚举值
--
-- 安全红线：
--   - next_retry_at 字段仅 RETRY_SCHEDULED 状态有值，其他状态为 NULL
--   - dead_lettered_at 字段仅 DEAD_LETTER 状态有值，其他状态为 NULL
--   - retry_reason 不记录敏感 PII（仅错误信息摘要），PII 分级 L3
--   - dead_letter_reason 同上，PII 分级 L3
--
-- 性能考量：
--   - idx_queue_task_retry_schedule 索引只对 RETRY_SCHEDULED 状态建索引（部分索引），
--     WorkerScheduler 每 10 秒扫描一次，命中率高
--   - idx_queue_task_dead_letter 索引只对 DEAD_LETTER 状态建索引，
--     死信队列页面查询按 dead_lettered_at 降序

-- ============================================================
-- 1. operations.queue_task 新增字段（V1.6 Worker Scheduler + DeadLetterQueue）
-- ============================================================
ALTER TABLE operations.queue_task ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE operations.queue_task ADD COLUMN IF NOT EXISTS retry_reason VARCHAR(500);
ALTER TABLE operations.queue_task ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;
ALTER TABLE operations.queue_task ADD COLUMN IF NOT EXISTS dead_letter_reason VARCHAR(500);

-- ============================================================
-- 2. 新增索引（V1.6）
-- ============================================================

-- 扫描到期重试任务：WorkerSchedulerService.scanAndResetRetryScheduledTasks() 每 10 秒查询
-- 索引条件：status = 'RETRY_SCHEDULED' AND next_retry_at IS NOT NULL AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_queue_task_retry_schedule
    ON operations.queue_task(next_retry_at)
    WHERE status = 'RETRY_SCHEDULED' AND next_retry_at IS NOT NULL AND deleted_at IS NULL;

-- 死信队列查询：DeadLetterTask API 按 dead_lettered_at 降序分页查询
-- 索引条件：status = 'DEAD_LETTER' AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_queue_task_dead_letter
    ON operations.queue_task(tenant_id, dead_lettered_at DESC)
    WHERE status = 'DEAD_LETTER' AND deleted_at IS NULL;

-- ============================================================
-- 3. 更新字段注释（V1.6）
-- ============================================================
COMMENT ON COLUMN operations.queue_task.status IS '状态：QUEUED/RUNNING/PAUSED/FAILED/COMPLETED/RETRY_SCHEDULED/DEAD_LETTER';
COMMENT ON COLUMN operations.queue_task.next_retry_at IS '下次重试时间（V1.6，RETRY_SCHEDULED 状态由指数退避计算，WorkerScheduler 扫描重置为 QUEUED）';
COMMENT ON COLUMN operations.queue_task.retry_reason IS '重试原因（V1.6，最近失败原因摘要，PII: L3）';
COMMENT ON COLUMN operations.queue_task.dead_lettered_at IS '进入死信队列时间（V1.6，DEAD_LETTER 状态记录）';
COMMENT ON COLUMN operations.queue_task.dead_letter_reason IS '进入死信队列原因（V1.6，如 Max retries exceeded，PII: L3）';

-- ============================================================
-- 4. 状态机流转注释（V1.6 完整状态机）
-- ============================================================
COMMENT ON TABLE operations.queue_task IS '队列任务（D37.17，PII: L3 业务敏感数据 payload）
状态机流转（V1.6）：
  QUEUED → RUNNING → COMPLETED（正常路径）
  QUEUED/RUNNING → PAUSED → RESUME → QUEUED（暂停/恢复）
  RUNNING → failTask → RETRY_SCHEDULED → WorkerScheduler → QUEUED（自动重试，指数退避）
  RUNNING → failTask (达到 maxRetries) → DEAD_LETTER（死信，需人工 replay 或删除）
  FAILED/RETRY_SCHEDULED → retryTask → QUEUED（手动重试）
  任意非终态 → cancelTask → PAUSED（取消占位）';
