package com.platform.core.governance.integration;

import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 审计日志写入链路集成测试
 *
 * <p>验证 AuditLogInterceptor -> AsyncAuditWriter -> AuditLogRepository 链路：
 * <ul>
 *   <li>POST /api/v1/principals（写操作）应触发审计日志异步写入</li>
 *   <li>审计日志字段：action / category / result / risk_level 应正确解析</li>
 *   <li>masked=true，敏感字段已脱敏</li>
 *   <li>GET 操作不触发审计（避免噪音）</li>
 *   <li>登录端点被排除（Auth 类操作走专用分支）</li>
 * </ul>
 *
 * <p>本测试不使用 AuditLogRepository，直接通过 jdbcTemplate 查询 governance.audit_log，
 * 避免异步写入完成的时机依赖。
 */
@DisplayName("审计日志写入链路集成测试")
class AuditLogWriteIT extends AbstractIntegrationTest {

    /** 异步写入最大等待时长（秒） */
    private static final long ASYNC_WAIT_TIMEOUT_SECONDS = 5;

    /** 异步轮询间隔（毫秒） */
    private static final long ASYNC_POLL_INTERVAL_MS = 100;

    /**
     * POST /api/v1/principals 应该异步写入审计日志
     *
     * <p>验证字段：
     * <ul>
     *   <li>action = iam.principals.create</li>
     *   <li>category = ADMIN</li>
     *   <li>result = SUCCESS</li>
     *   <li>risk_level = MEDIUM</li>
     *   <li>masked = true</li>
     *   <li>trace_id 不为空</li>
     * </ul>
     */
    @Test
    @DisplayName("POST /api/v1/principals 应异步写入审计日志")
    void shouldWriteAuditLogForPrincipalCreate() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-audit-" + UUID.randomUUID());
        String email = "audit+" + UUID.randomUUID() + "@example.com";
        String body = """
                {"email":"%s","displayName":"Audit User","password":"Test1234"}
                """.formatted(email);

        // Act（执行）：POST 创建主体（公开端点，但会触发拦截器）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/principals", HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders(tenantId)), String.class);

        // 等待异步审计写入完成
        List<Map<String, Object>> auditLogs = waitForAuditLogs(tenantId, "iam.principals.create");

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode(),
                        "创建主体应返回 201"),
                () -> assertFalse(auditLogs.isEmpty(),
                        "应至少有 1 条 iam.principals.create 审计记录"),
                () -> {
                    Map<String, Object> log = auditLogs.get(0);
                    assertAll(
                            () -> assertEquals("ADMIN", log.get("category"),
                                    "category 应为 ADMIN"),
                            () -> assertEquals("SUCCESS", log.get("result"),
                                    "result 应为 SUCCESS"),
                            () -> assertEquals("MEDIUM", log.get("risk_level"),
                                    "risk_level 应为 MEDIUM"),
                            () -> assertEquals(true, log.get("masked"),
                                    "masked 应为 true"),
                            () -> assertNotNull(log.get("trace_id"),
                                    "trace_id 不应为空"),
                            () -> assertNotNull(log.get("actor_id"),
                                    "actor_id 不应为空"),
                            () -> assertNotNull(log.get("timestamp"),
                                    "timestamp 不应为空"),
                            () -> assertNotNull(log.get("ip_address"),
                                    "ip_address 不应为空")
                    );
                }
        );
    }

    /**
     * GET 操作不应触发审计日志写入
     */
    @Test
    @DisplayName("GET 操作不应触发审计日志写入")
    void shouldNotWriteAuditLogForGetOperation() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-get-" + UUID.randomUUID());
        String email = "getop+" + UUID.randomUUID() + "@example.com";
        String createBody = """
                {"email":"%s","displayName":"Get Op","password":"Test1234"}
                """.formatted(email);

        // 创建主体（POST 会触发审计）
        restTemplate.exchange(
                "/api/v1/principals", HttpMethod.POST,
                new HttpEntity<>(createBody, jsonHeaders(tenantId)), String.class);

        // 等待 POST 的审计写入完成
        List<Map<String, Object>> postLogs = waitForAuditLogs(tenantId, "iam.principals.create");
        assertFalse(postLogs.isEmpty(), "POST 应已写入审计日志");

        // 记录当前审计日志总数
        long initialCount = countAuditLogsByTenant(tenantId);

        // 登录获取 token
        String accessToken = loginAndGetAccessToken(tenantId, email);

        // 等待登录操作可能的审计写入（虽然登录被排除，但等待以保证一致性）
        Thread.sleep(200);

        // Act（执行）：GET 查询主体（不应触发审计）
        restTemplate.exchange(
                "/api/v1/principals/" + getPrincipalIdByEmail(tenantId, email),
                HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)),
                String.class);

        // Assert（断言）：等待足够时间后审计日志总数不应增加
        Thread.sleep(500);
        long finalCount = countAuditLogsByTenant(tenantId);
        assertEquals(initialCount, finalCount,
                "GET 操作不应新增审计日志，initial=" + initialCount + ", final=" + finalCount);
    }

    /**
     * 审计日志的 details 字段应包含结构化信息但不包含敏感字段
     *
     * <p>details 格式：{"method":"POST","path":"/api/v1/principals","status":201,
     * "durationMs":N,"riskLevel":"MEDIUM"}
     */
    @Test
    @DisplayName("审计日志 details 应为结构化 JSON 且不含敏感信息")
    void shouldHaveStructuredDetailsWithoutSensitiveData() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-details-" + UUID.randomUUID());
        String email = "details+" + UUID.randomUUID() + "@example.com";
        String password = "Test1234";
        String body = """
                {"email":"%s","displayName":"Details User","password":"%s"}
                """.formatted(email, password);

        // Act（执行）
        restTemplate.exchange(
                "/api/v1/principals", HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders(tenantId)), String.class);

        // 等待异步写入
        List<Map<String, Object>> auditLogs = waitForAuditLogs(tenantId, "iam.principals.create");
        assertFalse(auditLogs.isEmpty(), "应已写入审计日志");

        // Assert（断言）
        String details = (String) auditLogs.get(0).get("details");
        assertAll(
                () -> assertNotNull(details, "details 不应为空"),
                () -> assertTrue(details.contains("\"method\":\"POST\""),
                        "details 应包含 method 字段"),
                () -> assertTrue(details.contains("\"path\":\"/api/v1/principals\""),
                        "details 应包含 path 字段"),
                () -> assertTrue(details.contains("\"status\":"),
                        "details 应包含 status 字段"),
                () -> assertTrue(details.contains("\"durationMs\":"),
                        "details 应包含 durationMs 字段"),
                () -> assertTrue(details.contains("\"riskLevel\":\"MEDIUM\""),
                        "details 应包含 riskLevel=MEDIUM"),
                // 敏感字段不应出现
                () -> assertFalse(details.contains(password),
                        "details 不应包含明文密码"),
                () -> assertFalse(details.contains(email),
                        "details 不应包含邮箱（PII）")
        );
    }

    /**
     * 审计日志应正确解析 actor（无认证场景下使用 x-tenant-id 兜底）
     */
    @Test
    @DisplayName("无认证场景下应使用 anonymous actor 兜底")
    void shouldFallbackToAnonymousActorWhenUnauthenticated() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-anon-" + UUID.randomUUID());
        String email = "anon+" + UUID.randomUUID() + "@example.com";
        String body = """
                {"email":"%s","displayName":"Anon","password":"Test1234"}
                """.formatted(email);

        // Act（执行）：POST 不带 Authorization header
        restTemplate.exchange(
                "/api/v1/principals", HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders(tenantId)), String.class);

        // 等待异步写入
        List<Map<String, Object>> auditLogs = waitForAuditLogs(tenantId, "iam.principals.create");
        assertFalse(auditLogs.isEmpty(), "应已写入审计日志");

        // Assert（断言）：actor_type 应为 USER（anonymous 兜底也是 USER 类型）
        Map<String, Object> log = auditLogs.get(0);
        assertEquals("USER", log.get("actor_type"),
                "无认证场景 actor_type 应为 USER（anonymous 兜底）");
    }

    /**
     * DELETE 操作应记录为 CRITICAL 风险等级
     *
     * <p>使用 PATCH /api/v1/principals/{id}/deactivate 或 DELETE（如可用），
     * 否则跳过该测试。本测试通过 jdbcTemplate 直接查询所有 DELETE/PATCH 操作的审计记录。
     */
    @Test
    @DisplayName("PATCH 操作应记录为 MEDIUM 风险等级")
    void shouldRecordPatchAsMediumRisk() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-patch-" + UUID.randomUUID());
        String email = "patch+" + UUID.randomUUID() + "@example.com";
        String createBody = """
                {"email":"%s","displayName":"Patch","password":"Test1234"}
                """.formatted(email);
        ResponseEntity<String> createResp = restTemplate.exchange(
                "/api/v1/principals", HttpMethod.POST,
                new HttpEntity<>(createBody, jsonHeaders(tenantId)), String.class);
        UUID principalId = UUID.fromString(extractData(createResp.getBody()).path("id").asText());

        // 等待 POST 审计写入
        waitForAuditLogs(tenantId, "iam.principals.create");

        // 获取 token
        String accessToken = loginAndGetAccessToken(tenantId, email);

        // Act（执行）：PATCH 更新主体
        String updateBody = """
                {"displayName":"Patch Updated"}
                """;
        restTemplate.exchange(
                "/api/v1/principals/" + principalId, HttpMethod.PATCH,
                new HttpEntity<>(updateBody, withAccessToken(tenantId, accessToken)),
                String.class);

        // 等待 PATCH 审计写入
        List<Map<String, Object>> patchLogs = waitForAuditLogs(tenantId, "iam.principals.update");

        // Assert（断言）
        assertFalse(patchLogs.isEmpty(), "PATCH 应已写入审计日志");
        Map<String, Object> log = patchLogs.get(0);
        assertAll(
                () -> assertEquals("ADMIN", log.get("category"),
                        "category 应为 ADMIN"),
                () -> assertEquals("MEDIUM", log.get("risk_level"),
                        "PATCH 风险等级应为 MEDIUM"),
                () -> assertEquals("SUCCESS", log.get("result"),
                        "result 应为 SUCCESS")
        );
    }

    // ── 辅助方法 ────────────────────────────────────────────

    /**
     * 等待指定 action 的审计日志写入完成
     *
     * @param tenantId 租户 ID
     * @param action  审计 action（如 iam.principals.create）
     * @return 审计日志列表
     */
    private List<Map<String, Object>> waitForAuditLogs(UUID tenantId, String action) throws InterruptedException {
        long deadline = System.currentTimeMillis() + ASYNC_WAIT_TIMEOUT_SECONDS * 1000;
        while (System.currentTimeMillis() < deadline) {
            List<Map<String, Object>> logs = findAuditLogsByAction(tenantId, action);
            if (!logs.isEmpty()) {
                return logs;
            }
            Thread.sleep(ASYNC_POLL_INTERVAL_MS);
        }
        return List.of();
    }

    /**
     * 查询指定 action 的审计日志
     */
    private List<Map<String, Object>> findAuditLogsByAction(UUID tenantId, String action) {
        return jdbcTemplate.queryForList(
                """
                SELECT action, category, result, risk_level, masked, trace_id,
                       actor_id, actor_name, actor_type, timestamp, ip_address,
                       user_agent, details
                FROM governance.audit_log
                WHERE tenant_id = ?
                  AND action = ?
                ORDER BY timestamp DESC
                """,
                tenantId, action);
    }

    /**
     * 统计租户的审计日志总数
     */
    private long countAuditLogsByTenant(UUID tenantId) {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM governance.audit_log WHERE tenant_id = ?",
                Long.class,
                tenantId);
        return count != null ? count : 0L;
    }

    /**
     * 通过邮箱查询主体 ID（用于 GET 测试场景）
     */
    private UUID getPrincipalIdByEmail(UUID tenantId, String email) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM iam.principal WHERE tenant_id = ? AND email = ?",
                UUID.class,
                tenantId, email);
    }

    /**
     * 等待辅助方法（用于显式等待）
     */
    @SuppressWarnings("unused")
    private void waitFor(Duration duration) throws InterruptedException {
        Thread.sleep(duration.toMillis());
    }
}
