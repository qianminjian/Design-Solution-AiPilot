-- V14__init_platform_saga.sql
-- 平台事件/Saga 域：创建 saga_instance 表，补全 outbox_event 审计字段
-- 权威源：@design/D34-数据-数据库.md §3（聚合间事件一致；跨服务不用分布式事务，
-- 以 Transactional Outbox、幂等消费者和 Saga/补偿实现）

-- ============================================================
-- 1. 补全 outbox_event 表的审计字段
-- ============================================================
-- V4 创建 outbox_event 时缺少 row_version（乐观锁）与 updated_at 字段，
-- OutboxEvent 实体使用 @Version 注解，需要这两列才能正确持久化。

ALTER TABLE platform.outbox_event
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS row_version BIGINT NOT NULL DEFAULT 1;

COMMENT ON COLUMN platform.outbox_event.updated_at IS '最近更新时间（审计）';
COMMENT ON COLUMN platform.outbox_event.row_version IS '乐观锁版本号';

-- 为 updated_at 创建触发器（V4 已批量创建，这里幂等补全）
DROP TRIGGER IF EXISTS set_timestamp_outbox ON platform.outbox_event;
CREATE TRIGGER set_timestamp_outbox
    BEFORE UPDATE ON platform.outbox_event
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ============================================================
-- 2. 创建 saga_instance 表
-- ============================================================
-- Saga 模式核心：跨服务长事务编排，每步成功后写入步骤历史，
-- 失败时按步骤历史反向补偿。

CREATE TABLE platform.saga_instance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES iam.tenant(id) ON DELETE CASCADE,
    saga_type VARCHAR(200) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'STARTED',
    current_step VARCHAR(200),
    completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    context_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    trace_id VARCHAR(255),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_error TEXT,
    classification data_classification NOT NULL DEFAULT 'PROJECT_RECORD',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES iam.principal(id),
    updated_by UUID REFERENCES iam.principal(id),
    row_version BIGINT NOT NULL DEFAULT 1
);

-- 索引：按聚合根查询 Saga 历史（用于审计与重放）
CREATE INDEX idx_saga_aggregate
    ON platform.saga_instance(tenant_id, aggregate_type, aggregate_id, started_at DESC);

-- 索引：按状态扫描（用于补偿调度器扫描 COMPENSATING 状态的 Saga）
CREATE INDEX idx_saga_status
    ON platform.saga_instance(status, started_at DESC)
    WHERE status IN ('STARTED', 'COMPENSATING');

-- 索引：按类型查询（用于监控指标，如统计各 Saga 类型的执行情况）
CREATE INDEX idx_saga_type
    ON platform.saga_instance(tenant_id, saga_type, started_at DESC);

COMMENT ON TABLE platform.saga_instance IS 'Saga 实例表（D34.3 跨服务长事务编排）';
COMMENT ON COLUMN platform.saga_instance.status IS 'STARTED/COMPLETED/COMPENSATING/COMPENSATED/FAILED/ABORTED';
COMMENT ON COLUMN platform.saga_instance.completed_steps IS '已完成步骤列表（JSON 数组，补偿时按逆序执行）';
COMMENT ON COLUMN platform.saga_instance.context_payload IS 'Saga 上下文负载（步骤间共享状态）';

-- 为 saga_instance 创建 updated_at 触发器
DROP TRIGGER IF EXISTS set_timestamp_saga ON platform.saga_instance;
CREATE TRIGGER set_timestamp_saga
    BEFORE UPDATE ON platform.saga_instance
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
