package com.platform.core.governance.integration;

import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 治理域数据库 Schema 集成测试（V17__init_governance.sql）
 *
 * <p>验证 V17 迁移脚本治理域 8 张表 DDL 落库正确：
 * <ul>
 *   <li>表存在：access_grant / releases / data_asset / audit_log /
 *       evidence_package / evidence_item / backup_point / restore_drill</li>
 *   <li>关键字段存在（含 PII 标注字段）</li>
 *   <li>关键索引存在</li>
 *   <li>审计字段（created_at / updated_at / row_version）存在</li>
 * </ul>
 *
 * <p>通过 AbstractIntegrationTest.resetDatabase() 的 Flyway clean + migrate
 * 已完成 V1-V17 全部迁移脚本执行，本测试只读取 information_schema 验证结构。
 */
@DisplayName("治理域 V17 迁移脚本 Schema 集成测试")
class GovernanceSchemaIT extends AbstractIntegrationTest {

    private static final String GOVERNANCE_SCHEMA = "governance";

    /** 治理域 8 张表（V17 迁移脚本创建） */
    private static final List<String> EXPECTED_TABLES = List.of(
            "access_grant",
            "releases",
            "data_asset",
            "audit_log",
            "evidence_package",
            "evidence_item",
            "backup_point",
            "restore_drill"
    );

    /**
     * 应该在 governance schema 下创建 8 张表
     */
    @Test
    @DisplayName("应该在 governance schema 下创建 8 张治理域表")
    void shouldCreateAllGovernanceTables() {
        // Act（执行）
        List<String> tables = jdbcTemplate.queryForList(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = ?
                ORDER BY table_name
                """,
                String.class,
                GOVERNANCE_SCHEMA);

        // Assert（断言）
        assertAll(
                () -> assertFalse(tables.isEmpty(), "governance schema 不应为空"),
                () -> assertTrue(tables.containsAll(EXPECTED_TABLES),
                        "应包含全部 8 张治理域表，实际: " + tables)
        );
    }

    /**
     * access_grant 表应包含关键字段（含 PII 标注字段）
     */
    @Test
    @DisplayName("access_grant 表应包含关键字段（含 PII 标注）")
    void shouldHaveAccessGrantColumns() {
        List<String> columns = getColumnNames("access_grant");

        assertAll(
                () -> assertTrue(columns.contains("id"), "应包含 id"),
                () -> assertTrue(columns.contains("tenant_id"), "应包含 tenant_id"),
                () -> assertTrue(columns.contains("type"), "应包含 type"),
                () -> assertTrue(columns.contains("principal_name"), "应包含 principal_name"),
                () -> assertTrue(columns.contains("principal_email"), "应包含 principal_email"),
                () -> assertTrue(columns.contains("resource"), "应包含 resource"),
                () -> assertTrue(columns.contains("permission"), "应包含 permission"),
                () -> assertTrue(columns.contains("risk_level"), "应包含 risk_level"),
                () -> assertTrue(columns.contains("status"), "应包含 status"),
                () -> assertTrue(columns.contains("granted_by"), "应包含 granted_by"),
                () -> assertTrue(columns.contains("granted_at"), "应包含 granted_at"),
                () -> assertTrue(columns.contains("expires_at"), "应包含 expires_at"),
                () -> assertTrue(columns.contains("requires_step_up"), "应包含 requires_step_up"),
                () -> assertTrue(columns.contains("has_legal_hold"), "应包含 has_legal_hold"),
                () -> assertTrue(columns.contains("propagation_dependents"),
                        "应包含 propagation_dependents"),
                // 审计字段
                () -> assertTrue(columns.contains("created_at"), "应包含 created_at"),
                () -> assertTrue(columns.contains("updated_at"), "应包含 updated_at"),
                () -> assertTrue(columns.contains("row_version"), "应包含 row_version"),
                () -> assertTrue(columns.contains("deleted_at"), "应包含 deleted_at")
        );
    }

    /**
     * audit_log 表应包含关键字段（注意：审计日志只追加，无 deleted_at）
     */
    @Test
    @DisplayName("audit_log 表应包含关键字段（只追加，无 deleted_at）")
    void shouldHaveAuditLogColumns() {
        List<String> columns = getColumnNames("audit_log");

        assertAll(
                () -> assertTrue(columns.contains("id"), "应包含 id"),
                () -> assertTrue(columns.contains("tenant_id"), "应包含 tenant_id"),
                () -> assertTrue(columns.contains("timestamp"), "应包含 timestamp"),
                () -> assertTrue(columns.contains("actor_id"), "应包含 actor_id"),
                () -> assertTrue(columns.contains("actor_name"), "应包含 actor_name"),
                () -> assertTrue(columns.contains("actor_type"), "应包含 actor_type"),
                () -> assertTrue(columns.contains("action"), "应包含 action"),
                () -> assertTrue(columns.contains("category"), "应包含 category"),
                () -> assertTrue(columns.contains("object_type"), "应包含 object_type"),
                () -> assertTrue(columns.contains("object_id"), "应包含 object_id"),
                () -> assertTrue(columns.contains("trace_id"), "应包含 trace_id"),
                () -> assertTrue(columns.contains("result"), "应包含 result"),
                () -> assertTrue(columns.contains("risk_level"), "应包含 risk_level"),
                () -> assertTrue(columns.contains("masked"), "应包含 masked"),
                () -> assertTrue(columns.contains("ip_address"), "应包含 ip_address"),
                () -> assertTrue(columns.contains("user_agent"), "应包含 user_agent"),
                () -> assertTrue(columns.contains("details"), "应包含 details"),
                // 审计字段（仅 created_at/updated_at/row_version，无 deleted_at）
                () -> assertTrue(columns.contains("created_at"), "应包含 created_at"),
                () -> assertTrue(columns.contains("updated_at"), "应包含 updated_at"),
                () -> assertTrue(columns.contains("row_version"), "应包含 row_version"),
                () -> assertFalse(columns.contains("deleted_at"),
                        "audit_log 只追加，不应包含 deleted_at"),
                () -> assertFalse(columns.contains("deleted_by"),
                        "audit_log 只追加，不应包含 deleted_by")
        );
    }

    /**
     * releases 表应包含关键字段（diff 摘要 + 红队测试）
     */
    @Test
    @DisplayName("releases 表应包含 diff 摘要与红队测试字段")
    void shouldHaveReleasesColumns() {
        List<String> columns = getColumnNames("releases");

        assertAll(
                () -> assertTrue(columns.contains("name"), "应包含 name"),
                () -> assertTrue(columns.contains("type"), "应包含 type"),
                () -> assertTrue(columns.contains("version"), "应包含 version"),
                () -> assertTrue(columns.contains("previous_version"),
                        "应包含 previous_version"),
                () -> assertTrue(columns.contains("status"), "应包含 status"),
                () -> assertTrue(columns.contains("release_manager"),
                        "应包含 release_manager"),
                () -> assertTrue(columns.contains("promoted_at"), "应包含 promoted_at"),
                () -> assertTrue(columns.contains("eval_score"), "应包含 eval_score"),
                () -> assertTrue(columns.contains("eval_slices"), "应包含 eval_slices"),
                () -> assertTrue(columns.contains("redteam_status"),
                        "应包含 redteam_status"),
                () -> assertTrue(columns.contains("consumer_count"),
                        "应包含 consumer_count"),
                () -> assertTrue(columns.contains("canary_percent"),
                        "应包含 canary_percent"),
                () -> assertTrue(columns.contains("metrics_drift"),
                        "应包含 metrics_drift"),
                () -> assertTrue(columns.contains("has_eval_gap"), "应包含 has_eval_gap"),
                () -> assertTrue(columns.contains("has_old_consumer"),
                        "应包含 has_old_consumer"),
                () -> assertTrue(columns.contains("diff_added"), "应包含 diff_added"),
                () -> assertTrue(columns.contains("diff_modified"),
                        "应包含 diff_modified"),
                () -> assertTrue(columns.contains("diff_removed"),
                        "应包含 diff_removed")
        );
    }

    /**
     * data_asset 表应包含数据保留与质量评分字段
     */
    @Test
    @DisplayName("data_asset 表应包含数据保留与质量评分字段")
    void shouldHaveDataAssetColumns() {
        List<String> columns = getColumnNames("data_asset");

        assertAll(
                () -> assertTrue(columns.contains("type"), "应包含 type"),
                () -> assertTrue(columns.contains("name"), "应包含 name"),
                () -> assertTrue(columns.contains("domain"), "应包含 domain"),
                () -> assertTrue(columns.contains("owner"), "应包含 owner"),
                () -> assertTrue(columns.contains("owner_email"), "应包含 owner_email"),
                () -> assertTrue(columns.contains("classification"),
                        "应包含 classification"),
                () -> assertTrue(columns.contains("retention_years"),
                        "应包含 retention_years"),
                () -> assertTrue(columns.contains("retention_legal_hold"),
                        "应包含 retention_legal_hold"),
                () -> assertTrue(columns.contains("retention_disposal_date"),
                        "应包含 retention_disposal_date"),
                () -> assertTrue(columns.contains("quality_score"),
                        "应包含 quality_score"),
                () -> assertTrue(columns.contains("quality_issues"),
                        "应包含 quality_issues"),
                () -> assertTrue(columns.contains("lineage_coverage"),
                        "应包含 lineage_coverage"),
                () -> assertTrue(columns.contains("storage_locations"),
                        "应包含 storage_locations")
        );
    }

    /**
     * evidence_package 与 evidence_item 表应存在且关联正确
     */
    @Test
    @DisplayName("evidence_package 与 evidence_item 表应存在且字段完整")
    void shouldHaveEvidenceTables() {
        List<String> packageColumns = getColumnNames("evidence_package");
        List<String> itemColumns = getColumnNames("evidence_item");

        assertAll(
                // 证据包字段
                () -> assertTrue(packageColumns.contains("name"), "package 应包含 name"),
                () -> assertTrue(packageColumns.contains("status"), "package 应包含 status"),
                () -> assertTrue(packageColumns.contains("object_id"),
                        "package 应包含 object_id"),
                () -> assertTrue(packageColumns.contains("object_type"),
                        "package 应包含 object_type"),
                () -> assertTrue(packageColumns.contains("sealed_by"),
                        "package 应包含 sealed_by"),
                () -> assertTrue(packageColumns.contains("sealed_at"),
                        "package 应包含 sealed_at"),
                () -> assertTrue(packageColumns.contains("verified_by"),
                        "package 应包含 verified_by"),
                () -> assertTrue(packageColumns.contains("hash"), "package 应包含 hash"),
                // 证据项字段
                () -> assertTrue(itemColumns.contains("package_id"),
                        "item 应包含 package_id"),
                () -> assertTrue(itemColumns.contains("source"), "item 应包含 source"),
                () -> assertTrue(itemColumns.contains("hash"), "item 应包含 hash"),
                () -> assertTrue(itemColumns.contains("captured_at"),
                        "item 应包含 captured_at")
        );
    }

    /**
     * backup_point 与 restore_drill 表应包含 RPO/RTO 字段
     */
    @Test
    @DisplayName("backup_point 与 restore_drill 表应包含 RPO/RTO 字段")
    void shouldHaveBackupAndRestoreTables() {
        List<String> backupColumns = getColumnNames("backup_point");
        List<String> drillColumns = getColumnNames("restore_drill");

        assertAll(
                // 备份点字段
                () -> assertTrue(backupColumns.contains("type"), "backup 应包含 type"),
                () -> assertTrue(backupColumns.contains("scope"), "backup 应包含 scope"),
                () -> assertTrue(backupColumns.contains("started_at"),
                        "backup 应包含 started_at"),
                () -> assertTrue(backupColumns.contains("completed_at"),
                        "backup 应包含 completed_at"),
                () -> assertTrue(backupColumns.contains("duration_sec"),
                        "backup 应包含 duration_sec"),
                () -> assertTrue(backupColumns.contains("size_bytes"),
                        "backup 应包含 size_bytes"),
                () -> assertTrue(backupColumns.contains("actual_rpo_min"),
                        "backup 应包含 actual_rpo_min"),
                () -> assertTrue(backupColumns.contains("status"),
                        "backup 应包含 status"),
                () -> assertTrue(backupColumns.contains("hash"), "backup 应包含 hash"),
                // 灾备演练字段
                () -> assertTrue(drillColumns.contains("backup_id"),
                        "drill 应包含 backup_id"),
                () -> assertTrue(drillColumns.contains("target"), "drill 应包含 target"),
                () -> assertTrue(drillColumns.contains("actual_rto_min"),
                        "drill 应包含 actual_rto_min"),
                () -> assertTrue(drillColumns.contains("actual_rpo_min"),
                        "drill 应包含 actual_rpo_min"),
                () -> assertTrue(drillColumns.contains("verifier"),
                        "drill 应包含 verifier"),
                () -> assertTrue(drillColumns.contains("passed"), "drill 应包含 passed")
        );
    }

    /**
     * 关键索引应存在（验证治理域查询性能）
     */
    @Test
    @DisplayName("应创建关键索引以保证查询性能")
    void shouldCreateKeyIndexes() {
        List<String> indexes = jdbcTemplate.queryForList(
                """
                SELECT indexname FROM pg_indexes
                WHERE schemaname = ?
                ORDER BY indexname
                """,
                String.class,
                GOVERNANCE_SCHEMA);

        assertAll(
                // access_grant 索引
                () -> assertTrue(indexes.contains("idx_access_grant_tenant_status"),
                        "应包含 idx_access_grant_tenant_status"),
                () -> assertTrue(indexes.contains("idx_access_grant_risk"),
                        "应包含 idx_access_grant_risk"),
                () -> assertTrue(indexes.contains("idx_access_grant_expires"),
                        "应包含 idx_access_grant_expires"),
                // audit_log 索引
                () -> assertTrue(indexes.contains("idx_audit_log_tenant_time"),
                        "应包含 idx_audit_log_tenant_time"),
                () -> assertTrue(indexes.contains("idx_audit_log_trace"),
                        "应包含 idx_audit_log_trace"),
                () -> assertTrue(indexes.contains("idx_audit_log_risk"),
                        "应包含 idx_audit_log_risk"),
                // releases 唯一索引
                () -> assertTrue(indexes.contains("idx_releases_name_version"),
                        "应包含 idx_releases_name_version（唯一索引）"),
                // data_asset 索引
                () -> assertTrue(indexes.contains("idx_data_asset_disposal"),
                        "应包含 idx_data_asset_disposal"),
                // backup_point / restore_drill 索引
                () -> assertTrue(indexes.contains("idx_backup_point_tenant_status"),
                        "应包含 idx_backup_point_tenant_status"),
                () -> assertTrue(indexes.contains("idx_restore_drill_tenant_status"),
                        "应包含 idx_restore_drill_tenant_status")
        );
    }

    /**
     * audit_log 表应包含字段注释（含 PII 标注）
     */
    @Test
    @DisplayName("audit_log 表应包含字段注释（含 PII 标注）")
    void shouldHaveAuditLogComments() {
        Map<String, String> comments = getColumnComments("audit_log");

        assertAll(
                () -> assertTrue(comments.get("ip_address").contains("PII"),
                        "ip_address 注释应包含 PII 标注"),
                () -> assertTrue(comments.get("user_agent").contains("PII"),
                        "user_agent 注释应包含 PII 标注"),
                () -> assertTrue(comments.get("details").contains("PII"),
                        "details 注释应包含 PII 标注"),
                () -> assertTrue(comments.get("action").contains("操作名称"),
                        "action 注释应描述操作名称")
        );
    }

    /**
     * access_grant 表应包含 PII 标注注释
     */
    @Test
    @DisplayName("access_grant 表应包含 PII 标注注释")
    void shouldHaveAccessGrantPiiComments() {
        Map<String, String> comments = getColumnComments("access_grant");

        assertAll(
                () -> assertTrue(comments.get("principal_email").contains("PII"),
                        "principal_email 注释应包含 PII 标注"),
                () -> assertTrue(comments.get("owner_email").contains("PII"),
                        "owner_email 注释应包含 PII 标注"),
                () -> assertTrue(comments.get("reason").contains("PII"),
                        "reason 注释应包含 PII 标注")
        );
    }

    /**
     * updated_at 触发器应存在（V17 末尾 DO $$ 块创建）
     */
    @Test
    @DisplayName("应创建 set_timestamp 触发器自动更新 updated_at")
    void shouldCreateTimestampTriggers() {
        List<String> triggers = jdbcTemplate.queryForList(
                """
                SELECT trigger_name FROM information_schema.triggers
                WHERE trigger_schema = ?
                  AND trigger_name = 'set_timestamp'
                ORDER BY event_object_table
                """,
                String.class,
                GOVERNANCE_SCHEMA);

        assertFalse(triggers.isEmpty(),
                "应至少创建一个 set_timestamp 触发器，实际: " + triggers);
    }

    // ── 辅助方法 ────────────────────────────────────────────

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
                GOVERNANCE_SCHEMA, tableName);
    }

    /**
     * 查询指定表的列注释（PostgreSQL pg_catalog.obj_description）
     */
    private Map<String, String> getColumnComments(String tableName) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT
                    a.attname AS column_name,
                    COALESCE(col_description(a.attrelid, a.attnum), '') AS comment
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = ?
                  AND c.relname = ?
                  AND a.attnum > 0
                  AND NOT a.attisdropped
                """,
                GOVERNANCE_SCHEMA, tableName);

        return rows.stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> (String) row.get("column_name"),
                        row -> (String) row.get("comment")
                ));
    }
}
