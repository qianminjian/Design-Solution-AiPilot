package com.platform.core.operations.integration;

import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 运营域数据库 Schema 集成测试（V19__init_operations.sql）
 *
 * <p>验证 V19 迁移脚本运营域 5 张表 DDL 落库正确：
 * <ul>
 *   <li>表存在：slo_target / queue_task / worker_status / connector_status / operations_action</li>
 *   <li>关键字段存在（含状态机字段、风险字段、审计字段、Hybrid-Site 字段）</li>
 *   <li>关键索引存在</li>
 *   <li>唯一约束（worker_status.worker_code / connector_status.connector_code / operations_action.operation_id）</li>
 *   <li>审计字段（created_at / updated_at / row_version）存在</li>
 * </ul>
 *
 * <p>通过 AbstractIntegrationTest.resetDatabase() 的 Flyway clean + migrate
 * 已完成 V1-V19 全部迁移脚本执行，本测试只读取 information_schema 验证结构。
 *
 * <p>权威源：@design/D37-关键界面-交互状态.md §D37.17、@design/D42-SLO-容量.md、
 * @design/D44-部署拓扑-Hybrid-Site.md、database.md（审计字段、命名约定）、
 * security.md（PII 分级、字段加密）、design-constraints.md（AI 安全红线、危险动作约束）。
 */
@DisplayName("运营域 V19 迁移脚本 Schema 集成测试")
class OperationsSchemaIT extends AbstractIntegrationTest {

    private static final String OPERATIONS_SCHEMA = "operations";

    /** 运营域 5 张表（V19 迁移脚本创建） */
    private static final List<String> EXPECTED_TABLES = List.of(
            "slo_target",
            "queue_task",
            "worker_status",
            "connector_status",
            "operations_action"
    );

    /**
     * 应该在 operations schema 下创建 5 张表
     */
    @Test
    @DisplayName("应该在 operations schema 下创建 5 张运营域表")
    void shouldCreateAllOperationsTables() {
        // Act（执行）
        List<String> tables = jdbcTemplate.queryForList(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = ?
                ORDER BY table_name
                """,
                String.class,
                OPERATIONS_SCHEMA);

        // Assert（断言）
        assertAll(
                () -> assertFalse(tables.isEmpty(), "operations schema 不应为空"),
                () -> assertTrue(tables.containsAll(EXPECTED_TABLES),
                        "应包含全部 5 张运营域表，实际: " + tables)
        );
    }

    /**
     * slo_target 表应包含关键字段（含 SLO 指标字段、健康状态字段）
     */
    @Test
    @DisplayName("slo_target 表应包含关键字段")
    void shouldHaveSloTargetColumns() {
        List<String> columns = getColumnNames("slo_target");

        assertAll(
                () -> assertTrue(columns.contains("id"), "应包含 id"),
                () -> assertTrue(columns.contains("tenant_id"), "应包含 tenant_id"),
                () -> assertTrue(columns.contains("name"), "应包含 name"),
                () -> assertTrue(columns.contains("availability_target"), "应包含 availability_target"),
                () -> assertTrue(columns.contains("availability_current"), "应包含 availability_current"),
                () -> assertTrue(columns.contains("error_budget_remaining"), "应包含 error_budget_remaining"),
                () -> assertTrue(columns.contains("request_count_24h"), "应包含 request_count_24h"),
                () -> assertTrue(columns.contains("error_count_24h"), "应包含 error_count_24h"),
                () -> assertTrue(columns.contains("p95_latency_ms"), "应包含 p95_latency_ms"),
                () -> assertTrue(columns.contains("p99_latency_ms"), "应包含 p99_latency_ms"),
                () -> assertTrue(columns.contains("status"), "应包含 status"),
                () -> assertTrue(columns.contains("service_name"), "应包含 service_name"),
                () -> assertTrue(columns.contains("window_days"), "应包含 window_days"),
                // 审计字段
                () -> assertTrue(columns.contains("created_at"), "应包含 created_at"),
                () -> assertTrue(columns.contains("updated_at"), "应包含 updated_at"),
                () -> assertTrue(columns.contains("created_by"), "应包含 created_by"),
                () -> assertTrue(columns.contains("updated_by"), "应包含 updated_by"),
                () -> assertTrue(columns.contains("row_version"), "应包含 row_version"),
                () -> assertTrue(columns.contains("deleted_at"), "应包含 deleted_at"),
                () -> assertTrue(columns.contains("deleted_by"), "应包含 deleted_by")
        );
    }

    /**
     * queue_task 表应包含关键字段（含 retry storm 检测字段、数据驻留字段）
     */
    @Test
    @DisplayName("queue_task 表应包含关键字段")
    void shouldHaveQueueTaskColumns() {
        List<String> columns = getColumnNames("queue_task");

        assertAll(
                () -> assertTrue(columns.contains("id"), "应包含 id"),
                () -> assertTrue(columns.contains("tenant_id"), "应包含 tenant_id"),
                () -> assertTrue(columns.contains("type"), "应包含 type"),
                () -> assertTrue(columns.contains("status"), "应包含 status"),
                () -> assertTrue(columns.contains("priority"), "应包含 priority"),
                () -> assertTrue(columns.contains("payload"), "应包含 payload（PII: L3）"),
                () -> assertTrue(columns.contains("worker_id"), "应包含 worker_id"),
                () -> assertTrue(columns.contains("queued_at"), "应包含 queued_at"),
                () -> assertTrue(columns.contains("started_at"), "应包含 started_at"),
                () -> assertTrue(columns.contains("completed_at"), "应包含 completed_at"),
                () -> assertTrue(columns.contains("duration_sec"), "应包含 duration_sec"),
                () -> assertTrue(columns.contains("retry_count"), "应包含 retry_count（retry storm 检测）"),
                () -> assertTrue(columns.contains("max_retries"), "应包含 max_retries（retry storm 阈值）"),
                () -> assertTrue(columns.contains("data_region"), "应包含 data_region（数据驻留约束）"),
                () -> assertTrue(columns.contains("last_error"), "应包含 last_error"),
                () -> assertTrue(columns.contains("project_id"), "应包含 project_id"),
                () -> assertTrue(columns.contains("stage_id"), "应包含 stage_id"),
                // 审计字段
                () -> assertTrue(columns.contains("created_at"), "应包含 created_at"),
                () -> assertTrue(columns.contains("updated_at"), "应包含 updated_at"),
                () -> assertTrue(columns.contains("row_version"), "应包含 row_version"),
                () -> assertTrue(columns.contains("deleted_at"), "应包含 deleted_at")
        );
    }

    /**
     * worker_status 表应包含关键字段（含 Hybrid-Site Region 字段、隔离状态字段）
     */
    @Test
    @DisplayName("worker_status 表应包含关键字段")
    void shouldHaveWorkerStatusColumns() {
        List<String> columns = getColumnNames("worker_status");

        assertAll(
                () -> assertTrue(columns.contains("id"), "应包含 id"),
                () -> assertTrue(columns.contains("tenant_id"), "应包含 tenant_id"),
                () -> assertTrue(columns.contains("worker_code"), "应包含 worker_code"),
                () -> assertTrue(columns.contains("type"), "应包含 type"),
                () -> assertTrue(columns.contains("status"), "应包含 status"),
                () -> assertTrue(columns.contains("current_task_id"), "应包含 current_task_id"),
                () -> assertTrue(columns.contains("current_task_payload"), "应包含 current_task_payload（PII: L3）"),
                () -> assertTrue(columns.contains("processed_count"), "应包含 processed_count"),
                () -> assertTrue(columns.contains("failed_count"), "应包含 failed_count"),
                () -> assertTrue(columns.contains("avg_duration_sec"), "应包含 avg_duration_sec"),
                () -> assertTrue(columns.contains("cpu_percent"), "应包含 cpu_percent"),
                () -> assertTrue(columns.contains("memory_percent"), "应包含 memory_percent"),
                () -> assertTrue(columns.contains("last_heartbeat"), "应包含 last_heartbeat"),
                () -> assertTrue(columns.contains("region"), "应包含 region（Hybrid-Site 部署字段）"),
                () -> assertTrue(columns.contains("is_customer_site_worker"), "应包含 is_customer_site_worker（客户站点 Worker 标识）"),
                () -> assertTrue(columns.contains("is_isolated"), "应包含 is_isolated（ISOLATE 动作执行后为 true）"),
                () -> assertTrue(columns.contains("isolated_reason"), "应包含 isolated_reason"),
                () -> assertTrue(columns.contains("isolated_at"), "应包含 isolated_at"),
                // 审计字段
                () -> assertTrue(columns.contains("created_at"), "应包含 created_at"),
                () -> assertTrue(columns.contains("updated_at"), "应包含 updated_at"),
                () -> assertTrue(columns.contains("row_version"), "应包含 row_version"),
                () -> assertTrue(columns.contains("deleted_at"), "应包含 deleted_at")
        );
    }

    /**
     * connector_status 表应包含关键字段（含 ManualHandoff 字段、许可证字段）
     */
    @Test
    @DisplayName("connector_status 表应包含关键字段")
    void shouldHaveConnectorStatusColumns() {
        List<String> columns = getColumnNames("connector_status");

        assertAll(
                () -> assertTrue(columns.contains("id"), "应包含 id"),
                () -> assertTrue(columns.contains("tenant_id"), "应包含 tenant_id"),
                () -> assertTrue(columns.contains("connector_code"), "应包含 connector_code"),
                () -> assertTrue(columns.contains("name"), "应包含 name"),
                () -> assertTrue(columns.contains("type"), "应包含 type"),
                () -> assertTrue(columns.contains("status"), "应包含 status"),
                () -> assertTrue(columns.contains("call_count_1h"), "应包含 call_count_1h"),
                () -> assertTrue(columns.contains("error_count_1h"), "应包含 error_count_1h"),
                () -> assertTrue(columns.contains("avg_latency_ms"), "应包含 avg_latency_ms"),
                () -> assertTrue(columns.contains("license_remaining"), "应包含 license_remaining"),
                () -> assertTrue(columns.contains("last_used_at"), "应包含 last_used_at"),
                () -> assertTrue(columns.contains("last_health_check_at"), "应包含 last_health_check_at"),
                () -> assertTrue(columns.contains("is_manual_handoff"), "应包含 is_manual_handoff（OD-05 外部 AI 约束）"),
                () -> assertTrue(columns.contains("endpoint_url"), "应包含 endpoint_url"),
                () -> assertTrue(columns.contains("region"), "应包含 region"),
                // 审计字段
                () -> assertTrue(columns.contains("created_at"), "应包含 created_at"),
                () -> assertTrue(columns.contains("updated_at"), "应包含 updated_at"),
                () -> assertTrue(columns.contains("row_version"), "应包含 row_version"),
                () -> assertTrue(columns.contains("deleted_at"), "应包含 deleted_at")
        );
    }

    /**
     * operations_action 表应包含关键字段（含危险动作字段、双人审批字段）
     */
    @Test
    @DisplayName("operations_action 表应包含关键字段")
    void shouldHaveOperationsActionColumns() {
        List<String> columns = getColumnNames("operations_action");

        assertAll(
                () -> assertTrue(columns.contains("id"), "应包含 id"),
                () -> assertTrue(columns.contains("tenant_id"), "应包含 tenant_id"),
                () -> assertTrue(columns.contains("operation_id"), "应包含 operation_id"),
                () -> assertTrue(columns.contains("action_type"), "应包含 action_type"),
                () -> assertTrue(columns.contains("target_type"), "应包含 target_type"),
                () -> assertTrue(columns.contains("target_id"), "应包含 target_id"),
                () -> assertTrue(columns.contains("risk_level"), "应包含 risk_level"),
                () -> assertTrue(columns.contains("status"), "应包含 status"),
                () -> assertTrue(columns.contains("reason"), "应包含 reason（PII: L2，必填）"),
                () -> assertTrue(columns.contains("step_up_token_hash"), "应包含 step_up_token_hash（PII: L1，不存储明文）"),
                () -> assertTrue(columns.contains("impact_preview_acknowledged"), "应包含 impact_preview_acknowledged"),
                () -> assertTrue(columns.contains("initiated_by"), "应包含 initiated_by"),
                () -> assertTrue(columns.contains("initiated_at"), "应包含 initiated_at"),
                () -> assertTrue(columns.contains("completed_at"), "应包含 completed_at"),
                () -> assertTrue(columns.contains("affected_count"), "应包含 affected_count"),
                () -> assertTrue(columns.contains("audit_trace_id"), "应包含 audit_trace_id（审计追踪）"),
                () -> assertTrue(columns.contains("error_message"), "应包含 error_message"),
                () -> assertTrue(columns.contains("reviewer1"), "应包含 reviewer1（IRREVERSIBLE 双人审批）"),
                () -> assertTrue(columns.contains("reviewer2"), "应包含 reviewer2（IRREVERSIBLE 双人审批）"),
                // 审计字段
                () -> assertTrue(columns.contains("created_at"), "应包含 created_at"),
                () -> assertTrue(columns.contains("updated_at"), "应包含 updated_at"),
                () -> assertTrue(columns.contains("row_version"), "应包含 row_version"),
                () -> assertTrue(columns.contains("deleted_at"), "应包含 deleted_at")
        );
    }

    /**
     * worker_status 表应在 (tenant_id, worker_code) 上创建唯一约束
     */
    @Test
    @DisplayName("worker_status 表应在 (tenant_id, worker_code) 上创建唯一约束")
    void shouldHaveUniqueConstraintOnWorkerCode() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        String workerCode = "worker-test-001";

        // 第一次插入应成功
        jdbcTemplate.update(
                """
                INSERT INTO operations.worker_status (
                    id, tenant_id, worker_code, type, status, last_heartbeat
                ) VALUES (?, ?, ?, ?, ?, NOW())
                """,
                UUID.randomUUID(), tenantId, workerCode, "AI", "IDLE");

        // 第二次插入相同 worker_code 应抛异常
        boolean threw = false;
        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO operations.worker_status (
                        id, tenant_id, worker_code, type, status, last_heartbeat
                    ) VALUES (?, ?, ?, ?, ?, NOW())
                    """,
                    UUID.randomUUID(), tenantId, workerCode, "AI", "IDLE");
        } catch (Exception ex) {
            threw = true;
        }
        assertTrue(threw, "重复 worker_code 应触发唯一约束异常");
    }

    /**
     * connector_status 表应在 (tenant_id, connector_code) 上创建唯一约束
     */
    @Test
    @DisplayName("connector_status 表应在 (tenant_id, connector_code) 上创建唯一约束")
    void shouldHaveUniqueConstraintOnConnectorCode() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        String connectorCode = "connector-test-001";

        // 第一次插入应成功
        jdbcTemplate.update(
                """
                INSERT INTO operations.connector_status (
                    id, tenant_id, connector_code, name, type, status, last_used_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
                """,
                UUID.randomUUID(), tenantId, connectorCode, "测试连接器", "LLM", "CONNECTED");

        // 第二次插入相同 connector_code 应抛异常
        boolean threw = false;
        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO operations.connector_status (
                        id, tenant_id, connector_code, name, type, status, last_used_at
                    ) VALUES (?, ?, ?, ?, ?, ?, NOW())
                    """,
                    UUID.randomUUID(), tenantId, connectorCode, "重复连接器", "LLM", "CONNECTED");
        } catch (Exception ex) {
            threw = true;
        }
        assertTrue(threw, "重复 connector_code 应触发唯一约束异常");
    }

    /**
     * operations_action 表应在 operation_id 上创建唯一约束
     */
    @Test
    @DisplayName("operations_action 表应在 operation_id 上创建唯一约束")
    void shouldHaveUniqueConstraintOnOperationId() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        String operationId = "OP-TEST-001";

        // 第一次插入应成功
        jdbcTemplate.update(
                """
                INSERT INTO operations.operations_action (
                    id, tenant_id, operation_id, action_type, target_type, target_id,
                    risk_level, status, reason, initiated_by, initiated_at, audit_trace_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
                """,
                UUID.randomUUID(), tenantId, operationId, "RETRY", "QUEUE_TASK", "qt-001",
                "MEDIUM", "QUEUED", "测试重试", "tester1", "trace-001");

        // 第二次插入相同 operation_id 应抛异常
        boolean threw = false;
        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO operations.operations_action (
                        id, tenant_id, operation_id, action_type, target_type, target_id,
                        risk_level, status, reason, initiated_by, initiated_at, audit_trace_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
                    """,
                    UUID.randomUUID(), tenantId, operationId, "RETRY", "QUEUE_TASK", "qt-002",
                    "MEDIUM", "QUEUED", "重复操作", "tester2", "trace-002");
        } catch (Exception ex) {
            threw = true;
        }
        assertTrue(threw, "重复 operation_id 应触发唯一约束异常");
    }

    /**
     * queue_task 表应创建关键索引（tenant_id + status 组合索引）
     */
    @Test
    @DisplayName("queue_task 表应创建关键索引")
    void shouldHaveQueueTaskIndexes() {
        List<String> indexes = getIndexNames("queue_task");

        assertAll(
                () -> assertFalse(indexes.isEmpty(), "queue_task 应至少有一个索引"),
                () -> assertTrue(indexes.stream().anyMatch(name -> name.contains("tenant") && name.contains("status")),
                        "应包含 tenant_id + status 组合索引，实际: " + indexes),
                () -> assertTrue(indexes.stream().anyMatch(name -> name.contains("tenant") && name.contains("type")),
                        "应包含 tenant_id + type 组合索引，实际: " + indexes),
                () -> assertTrue(indexes.stream().anyMatch(name -> name.contains("tenant") && name.contains("priority")),
                        "应包含 tenant_id + priority 组合索引，实际: " + indexes)
        );
    }

    /**
     * worker_status 表应创建关键索引（含心跳索引）
     */
    @Test
    @DisplayName("worker_status 表应创建关键索引")
    void shouldHaveWorkerStatusIndexes() {
        List<String> indexes = getIndexNames("worker_status");

        assertAll(
                () -> assertFalse(indexes.isEmpty(), "worker_status 应至少有一个索引"),
                () -> assertTrue(indexes.stream().anyMatch(name -> name.contains("tenant") && name.contains("status")),
                        "应包含 tenant_id + status 组合索引，实际: " + indexes),
                () -> assertTrue(indexes.stream().anyMatch(name -> name.contains("heartbeat")),
                        "应包含 last_heartbeat 索引（存活检测），实际: " + indexes)
        );
    }

    /**
     * operations_action 表应创建关键索引（含审计追踪索引）
     */
    @Test
    @DisplayName("operations_action 表应创建关键索引")
    void shouldHaveOperationsActionIndexes() {
        List<String> indexes = getIndexNames("operations_action");

        assertAll(
                () -> assertFalse(indexes.isEmpty(), "operations_action 应至少有一个索引"),
                () -> assertTrue(indexes.stream().anyMatch(name -> name.contains("tenant") && name.contains("action")),
                        "应包含 tenant_id + action_type 组合索引，实际: " + indexes),
                () -> assertTrue(indexes.stream().anyMatch(name -> name.contains("tenant") && name.contains("target")),
                        "应包含 tenant_id + target_type 组合索引，实际: " + indexes),
                () -> assertTrue(indexes.stream().anyMatch(name -> name.contains("initiated")),
                        "应包含 initiated_by 索引（审计追踪），实际: " + indexes)
        );
    }

    /**
     * queue_task 表应支持插入 retry storm 检测字段（retry_count > max_retries * 2 阈值）
     */
    @Test
    @DisplayName("queue_task 表应支持插入 retry storm 检测字段")
    void shouldInsertQueueTaskWithRetryStormFields() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");

        // 插入 retry_count=10、max_retries=3 的任务，模拟 retry storm 场景
        int rows = jdbcTemplate.update(
                """
                INSERT INTO operations.queue_task (
                    id, tenant_id, type, status, priority, payload,
                    retry_count, max_retries, data_region, queued_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                """,
                UUID.randomUUID(), tenantId, "AI_GENERATION", "FAILED", "HIGH", "测试 payload",
                10, 3, "us-east-1");

        assertEquals(1, rows, "应成功插入 1 行 retry storm 任务");
    }

    /**
     * worker_status 表应支持插入 Hybrid-Site 字段（region / is_customer_site_worker）
     */
    @Test
    @DisplayName("worker_status 表应支持插入 Hybrid-Site 字段")
    void shouldInsertWorkerStatusWithHybridSiteFields() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");

        int rows = jdbcTemplate.update(
                """
                INSERT INTO operations.worker_status (
                    id, tenant_id, worker_code, type, status,
                    region, is_customer_site_worker, is_isolated, last_heartbeat
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                """,
                UUID.randomUUID(), tenantId, "worker-customer-001", "AI", "RUNNING",
                "cn-beijing-1", true, false);

        assertEquals(1, rows, "应成功插入 1 行 Hybrid-Site Worker");
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    /**
     * 查询指定表的所有列名
     */
    private List<String> getColumnNames(String tableName) {
        return jdbcTemplate.queryForList(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = ? AND table_name = ?
                ORDER BY ordinal_position
                """,
                String.class,
                OPERATIONS_SCHEMA, tableName);
    }

    /**
     * 查询指定表的所有索引名
     */
    private List<String> getIndexNames(String tableName) {
        return jdbcTemplate.queryForList(
                """
                SELECT indexname FROM pg_indexes
                WHERE schemaname = ? AND tablename = ?
                ORDER BY indexname
                """,
                String.class,
                OPERATIONS_SCHEMA, tableName);
    }
}
