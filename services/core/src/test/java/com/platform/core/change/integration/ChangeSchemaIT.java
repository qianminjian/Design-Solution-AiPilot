package com.platform.core.change.integration;

import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 变更域数据库 Schema 集成测试（V18__init_change.sql）
 *
 * <p>验证 V18 迁移脚本变更域 5 张表 DDL 落库正确：
 * <ul>
 *   <li>表存在：change_request / affected_item / task_plan_item / closure_evidence / change_operation</li>
 *   <li>关键字段存在（含状态机字段、风险字段、审计字段）</li>
 *   <li>关键索引存在</li>
 *   <li>审计字段（created_at / updated_at / row_version）存在</li>
 * </ul>
 *
 * <p>通过 AbstractIntegrationTest.resetDatabase() 的 Flyway clean + migrate
 * 已完成 V1-V18 全部迁移脚本执行，本测试只读取 information_schema 验证结构。
 */
@DisplayName("变更域 V18 迁移脚本 Schema 集成测试")
class ChangeSchemaIT extends AbstractIntegrationTest {

    private static final String CHANGE_SCHEMA = "change";

    /** 变更域 5 张表（V18 迁移脚本创建） */
    private static final List<String> EXPECTED_TABLES = List.of(
            "change_request",
            "affected_item",
            "task_plan_item",
            "closure_evidence",
            "change_operation"
    );

    /**
     * 应该在 change schema 下创建 5 张表
     */
    @Test
    @DisplayName("应该在 change schema 下创建 5 张变更域表")
    void shouldCreateAllChangeTables() {
        // Act（执行）
        List<String> tables = jdbcTemplate.queryForList(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = ?
                ORDER BY table_name
                """,
                String.class,
                CHANGE_SCHEMA);

        // Assert（断言）
        assertAll(
                () -> assertFalse(tables.isEmpty(), "change schema 不应为空"),
                () -> assertTrue(tables.containsAll(EXPECTED_TABLES),
                        "应包含全部 5 张变更域表，实际: " + tables)
        );
    }

    /**
     * change_request 表应包含关键字段（含状态机字段、风险字段、审计字段）
     */
    @Test
    @DisplayName("change_request 表应包含关键字段")
    void shouldHaveChangeRequestColumns() {
        List<String> columns = getColumnNames("change_request");

        assertAll(
                () -> assertTrue(columns.contains("id"), "应包含 id"),
                () -> assertTrue(columns.contains("tenant_id"), "应包含 tenant_id"),
                () -> assertTrue(columns.contains("code"), "应包含 code"),
                () -> assertTrue(columns.contains("title"), "应包含 title"),
                () -> assertTrue(columns.contains("description"), "应包含 description"),
                () -> assertTrue(columns.contains("type"), "应包含 type"),
                () -> assertTrue(columns.contains("priority"), "应包含 priority"),
                () -> assertTrue(columns.contains("status"), "应包含 status"),
                () -> assertTrue(columns.contains("project_id"), "应包含 project_id"),
                () -> assertTrue(columns.contains("baseline_id"), "应包含 baseline_id"),
                () -> assertTrue(columns.contains("initiated_by"), "应包含 initiated_by"),
                () -> assertTrue(columns.contains("initiated_at"), "应包含 initiated_at"),
                () -> assertTrue(columns.contains("approved_by"), "应包含 approved_by"),
                () -> assertTrue(columns.contains("approved_at"), "应包含 approved_at"),
                () -> assertTrue(columns.contains("implemented_by"), "应包含 implemented_by"),
                () -> assertTrue(columns.contains("implemented_at"), "应包含 implemented_at"),
                () -> assertTrue(columns.contains("closed_by"), "应包含 closed_by"),
                () -> assertTrue(columns.contains("closed_at"), "应包含 closed_at"),
                () -> assertTrue(columns.contains("impact_assessment"), "应包含 impact_assessment"),
                () -> assertTrue(columns.contains("confirmed_no_impact"), "应包含 confirmed_no_impact"),
                () -> assertTrue(columns.contains("ai_assisted_analysis"), "应包含 ai_assisted_analysis"),
                () -> assertTrue(columns.contains("is_ai_assisted"), "应包含 is_ai_assisted"),
                () -> assertTrue(columns.contains("risk_assessment"), "应包含 risk_assessment"),
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
     * affected_item 表应包含关键字段（含影响项标记、复核状态字段）
     */
    @Test
    @DisplayName("affected_item 表应包含关键字段")
    void shouldHaveAffectedItemColumns() {
        List<String> columns = getColumnNames("affected_item");

        assertAll(
                () -> assertTrue(columns.contains("id"), "应包含 id"),
                () -> assertTrue(columns.contains("tenant_id"), "应包含 tenant_id"),
                () -> assertTrue(columns.contains("change_id"), "应包含 change_id"),
                () -> assertTrue(columns.contains("type"), "应包含 type"),
                () -> assertTrue(columns.contains("code"), "应包含 code"),
                () -> assertTrue(columns.contains("name"), "应包含 name"),
                () -> assertTrue(columns.contains("discipline"), "应包含 discipline"),
                () -> assertTrue(columns.contains("action"), "应包含 action"),
                () -> assertTrue(columns.contains("impact"), "应包含 impact"),
                () -> assertTrue(columns.contains("recheck_required"), "应包含 recheck_required"),
                () -> assertTrue(columns.contains("recheck_status"), "应包含 recheck_status"),
                () -> assertTrue(columns.contains("owner"), "应包含 owner"),
                () -> assertTrue(columns.contains("evidence"), "应包含 evidence"),
                () -> assertTrue(columns.contains("source_baseline_id"), "应包含 source_baseline_id"),
                () -> assertTrue(columns.contains("watermark"), "应包含 watermark"),
                () -> assertTrue(columns.contains("object_ref_id"), "应包含 object_ref_id"),
                () -> assertTrue(columns.contains("rechecked_at"), "应包含 rechecked_at"),
                () -> assertTrue(columns.contains("rechecked_by"), "应包含 rechecked_by"),
                // 审计字段
                () -> assertTrue(columns.contains("created_at"), "应包含 created_at"),
                () -> assertTrue(columns.contains("updated_at"), "应包含 updated_at"),
                () -> assertTrue(columns.contains("row_version"), "应包含 row_version"),
                () -> assertTrue(columns.contains("deleted_at"), "应包含 deleted_at")
        );
    }

    /**
     * task_plan_item 表应包含关键字段（含阻断关闭标记）
     */
    @Test
    @DisplayName("task_plan_item 表应包含关键字段")
    void shouldHaveTaskPlanItemColumns() {
        List<String> columns = getColumnNames("task_plan_item");

        assertAll(
                () -> assertTrue(columns.contains("id"), "应包含 id"),
                () -> assertTrue(columns.contains("tenant_id"), "应包含 tenant_id"),
                () -> assertTrue(columns.contains("change_id"), "应包含 change_id"),
                () -> assertTrue(columns.contains("title"), "应包含 title"),
                () -> assertTrue(columns.contains("description"), "应包含 description"),
                () -> assertTrue(columns.contains("assignee"), "应包含 assignee"),
                () -> assertTrue(columns.contains("discipline"), "应包含 discipline"),
                () -> assertTrue(columns.contains("status"), "应包含 status"),
                () -> assertTrue(columns.contains("due_date"), "应包含 due_date"),
                () -> assertTrue(columns.contains("completed_at"), "应包含 completed_at"),
                () -> assertTrue(columns.contains("completed_by"), "应包含 completed_by"),
                () -> assertTrue(columns.contains("affected_item_ids"), "应包含 affected_item_ids"),
                () -> assertTrue(columns.contains("priority"), "应包含 priority"),
                () -> assertTrue(columns.contains("sequence_order"), "应包含 sequence_order"),
                () -> assertTrue(columns.contains("blocks_closure"), "应包含 blocks_closure"),
                () -> assertTrue(columns.contains("skip_reason"), "应包含 skip_reason"),
                () -> assertTrue(columns.contains("skip_approved_by"), "应包含 skip_approved_by"),
                // 审计字段
                () -> assertTrue(columns.contains("created_at"), "应包含 created_at"),
                () -> assertTrue(columns.contains("updated_at"), "应包含 updated_at"),
                () -> assertTrue(columns.contains("row_version"), "应包含 row_version"),
                () -> assertTrue(columns.contains("deleted_at"), "应包含 deleted_at")
        );
    }

    /**
     * closure_evidence 表应包含关键字段（含双人复核字段）
     */
    @Test
    @DisplayName("closure_evidence 表应包含关键字段")
    void shouldHaveClosureEvidenceColumns() {
        List<String> columns = getColumnNames("closure_evidence");

        assertAll(
                () -> assertTrue(columns.contains("id"), "应包含 id"),
                () -> assertTrue(columns.contains("tenant_id"), "应包含 tenant_id"),
                () -> assertTrue(columns.contains("change_id"), "应包含 change_id"),
                () -> assertTrue(columns.contains("type"), "应包含 type"),
                () -> assertTrue(columns.contains("title"), "应包含 title"),
                () -> assertTrue(columns.contains("source_id"), "应包含 source_id"),
                () -> assertTrue(columns.contains("source_description"), "应包含 source_description"),
                () -> assertTrue(columns.contains("status"), "应包含 status"),
                () -> assertTrue(columns.contains("verified_by"), "应包含 verified_by"),
                () -> assertTrue(columns.contains("verified_at"), "应包含 verified_at"),
                () -> assertTrue(columns.contains("verification_note"), "应包含 verification_note"),
                () -> assertTrue(columns.contains("summary"), "应包含 summary"),
                () -> assertTrue(columns.contains("evidence_url"), "应包含 evidence_url"),
                () -> assertTrue(columns.contains("blocks_closure"), "应包含 blocks_closure"),
                () -> assertTrue(columns.contains("submitted_by"), "应包含 submitted_by"),
                () -> assertTrue(columns.contains("submitted_at"), "应包含 submitted_at"),
                () -> assertTrue(columns.contains("reviewer1"), "应包含 reviewer1"),
                () -> assertTrue(columns.contains("reviewer2"), "应包含 reviewer2"),
                // 审计字段
                () -> assertTrue(columns.contains("created_at"), "应包含 created_at"),
                () -> assertTrue(columns.contains("updated_at"), "应包含 updated_at"),
                () -> assertTrue(columns.contains("row_version"), "应包含 row_version"),
                () -> assertTrue(columns.contains("deleted_at"), "应包含 deleted_at")
        );
    }

    /**
     * change_operation 表应包含关键字段（操作阶段时间线）
     */
    @Test
    @DisplayName("change_operation 表应包含关键字段")
    void shouldHaveChangeOperationColumns() {
        List<String> columns = getColumnNames("change_operation");

        assertAll(
                () -> assertTrue(columns.contains("id"), "应包含 id"),
                () -> assertTrue(columns.contains("tenant_id"), "应包含 tenant_id"),
                () -> assertTrue(columns.contains("change_id"), "应包含 change_id"),
                () -> assertTrue(columns.contains("phase"), "应包含 phase"),
                () -> assertTrue(columns.contains("status"), "应包含 status"),
                () -> assertTrue(columns.contains("operator_id"), "应包含 operator_id"),
                () -> assertTrue(columns.contains("operated_at"), "应包含 operated_at"),
                () -> assertTrue(columns.contains("comment"), "应包含 comment"),
                () -> assertTrue(columns.contains("from_status"), "应包含 from_status"),
                () -> assertTrue(columns.contains("to_status"), "应包含 to_status"),
                () -> assertTrue(columns.contains("sequence"), "应包含 sequence"),
                // 审计字段
                () -> assertTrue(columns.contains("created_at"), "应包含 created_at"),
                () -> assertTrue(columns.contains("updated_at"), "应包含 updated_at"),
                () -> assertTrue(columns.contains("row_version"), "应包含 row_version")
        );
    }

    /**
     * change_request 表应在 code 字段上创建唯一索引
     */
    @Test
    @DisplayName("change_request 表应在 code 字段上创建唯一约束")
    void shouldHaveUniqueConstraintOnCode() {
        // 通过尝试插入重复 code 验证唯一约束
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        String code = "CHG-TEST-001";

        // 第一次插入应成功
        jdbcTemplate.update(
                """
                INSERT INTO change.change_request (
                    id, tenant_id, code, title, type, priority, status,
                    project_id, initiated_by, initiated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                """,
                UUID.randomUUID(), tenantId, code, "测试变更请求", "DESIGN_CHANGE", "MEDIUM", "DRAFT",
                "PROJ-001", "tester1");

        // 第二次插入相同 code 应抛异常
        boolean threw = false;
        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO change.change_request (
                        id, tenant_id, code, title, type, priority, status,
                        project_id, initiated_by, initiated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    """,
                    UUID.randomUUID(), tenantId, code, "重复变更请求", "DESIGN_CHANGE", "LOW", "DRAFT",
                    "PROJ-002", "tester2");
        } catch (Exception ex) {
            threw = true;
        }
        assertTrue(threw, "重复 code 应触发唯一约束异常");
    }

    /**
     * affected_item 表应创建关键索引（tenant_id + change_id 组合索引）
     */
    @Test
    @DisplayName("affected_item 表应创建关键索引")
    void shouldHaveAffectedItemIndexes() {
        List<String> indexes = getIndexNames("affected_item");

        assertAll(
                () -> assertFalse(indexes.isEmpty(), "affected_item 应至少有一个索引"),
                () -> assertTrue(indexes.stream().anyMatch(name -> name.contains("tenant") && name.contains("change")),
                        "应包含 tenant_id + change_id 组合索引，实际: " + indexes)
        );
    }

    /**
     * task_plan_item 表应创建关键索引
     */
    @Test
    @DisplayName("task_plan_item 表应创建关键索引")
    void shouldHaveTaskPlanItemIndexes() {
        List<String> indexes = getIndexNames("task_plan_item");

        assertAll(
                () -> assertFalse(indexes.isEmpty(), "task_plan_item 应至少有一个索引"),
                () -> assertTrue(indexes.stream().anyMatch(name -> name.contains("tenant") && name.contains("change")),
                        "应包含 tenant_id + change_id 组合索引，实际: " + indexes)
        );
    }

    /**
     * closure_evidence 表应创建关键索引
     */
    @Test
    @DisplayName("closure_evidence 表应创建关键索引")
    void shouldHaveClosureEvidenceIndexes() {
        List<String> indexes = getIndexNames("closure_evidence");

        assertAll(
                () -> assertFalse(indexes.isEmpty(), "closure_evidence 应至少有一个索引"),
                () -> assertTrue(indexes.stream().anyMatch(name -> name.contains("tenant") && name.contains("change")),
                        "应包含 tenant_id + change_id 组合索引，实际: " + indexes)
        );
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
                CHANGE_SCHEMA, tableName);
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
                CHANGE_SCHEMA, tableName);
    }
}
