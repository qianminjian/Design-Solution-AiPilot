package com.platform.core.migration;

import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Flyway 迁移集成测试
 *
 * <p>验证 V1-V4 迁移脚本在真实 PostgreSQL 16 容器中能正确执行，
 * 关键表与种子数据存在，确保 JPA 实体映射与数据库 schema 对齐。
 */
@DisplayName("Flyway 迁移集成测试")
class FlywayMigrationIT extends AbstractIntegrationTest {

    @Autowired
    private DataSource dataSource;

    /**
     * 应该成功执行所有迁移脚本
     *
     * <p>应用启动时 Flyway 自动执行迁移，若任何脚本失败应用无法启动。
     * 通过 Spring 上下文加载成功 + 健康检查通过间接验证迁移成功。
     */
    @Test
    @DisplayName("应该成功执行所有迁移脚本（V1-V4）")
    void shouldExecuteAllMigrationsSuccessfully() {
        // Arrange（准备）
        // Spring 上下文已加载即说明 Flyway 迁移成功

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/actuator/health", HttpMethod.GET, null, String.class);

        // Assert（断言）
        assertTrue(resp.getStatusCode().is2xxSuccessful(),
                "actuator/health 应返回 2xx，实际：" + resp.getStatusCode());
        assertTrue(resp.getBody() != null && resp.getBody().contains("\"UP\""),
                "健康检查应为 UP，实际：" + resp.getBody());
    }

    /**
     * 应该创建所有关键表
     *
     * <p>验证 V1-V4 创建的核心表在数据库中存在（覆盖 IAM / Portfolio / Platform 三个领域）。
     */
    @Test
    @DisplayName("应该创建所有关键表（iam / portfolio / platform）")
    void shouldHaveExpectedTables() throws Exception {
        // Arrange（准备）
        Set<String> expectedTables = Set.of(
                // iam 领域
                "tenant", "organization", "principal", "membership", "role_binding", "access_grant",
                // portfolio 领域
                "project", "stage_instance", "gate_decision", "project_baseline",
                // platform 领域
                "outbox_event");
        Set<String> actualTables = collectAllTables();

        // Act & Assert（执行 + 断言）
        assertAll(expectedTables.stream()
                .map(table -> () -> assertTrue(actualTables.contains(table),
                        "缺少表：" + table + "，实际表集合：" + actualTables)));
    }

    /**
     * 应该预置种子数据
     *
     * <p>V4 迁移插入了系统租户、系统组织、系统管理员主体与角色绑定，
     * 验证种子数据存在且符合预期。
     */
    @Test
    @DisplayName("应该预置种子数据（系统租户/组织/管理员）")
    void shouldHaveSeedData() throws Exception {
        // Arrange（准备）
        // 系统租户 code=system，由 V4 INSERT 语句预置

        // Act（执行）
        long tenantCount = countRows("iam", "tenant", "code = 'system'");
        long principalCount = countRows("iam", "principal",
                "email = 'admin@platform.local'");
        long roleBindingCount = countRows("iam", "role_binding",
                "role_code = 'PLATFORM_ADMIN'");

        // Assert（断言）
        assertAll(
                () -> assertEquals(1L, tenantCount, "系统租户应存在且唯一"),
                () -> assertEquals(1L, principalCount, "系统管理员主体应存在且唯一"),
                () -> assertEquals(1L, roleBindingCount, "PLATFORM_ADMIN 角色绑定应存在且唯一")
        );
    }

    // ── 内部辅助方法 ──

    /**
     * 收集数据库中所有表名（跨 schema）
     */
    private Set<String> collectAllTables() throws Exception {
        Set<String> tables = new HashSet<>();
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            try (ResultSet rs = meta.getTables(null, null, "%",
                    new String[]{"TABLE"})) {
                while (rs.next()) {
                    tables.add(rs.getString("TABLE_NAME"));
                }
            }
        }
        return tables;
    }

    /**
     * 按条件统计行数
     */
    private long countRows(String schema, String table, String whereClause) throws Exception {
        String sql = "SELECT COUNT(*) FROM %s.%s WHERE %s".formatted(schema, table, whereClause);
        try (Connection conn = dataSource.getConnection();
             var stmt = conn.createStatement();
             var rs = stmt.executeQuery(sql)) {
            rs.next();
            return rs.getLong(1);
        }
    }
}
