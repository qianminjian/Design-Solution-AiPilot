package com.platform.core.governance.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.governance.backup.domain.BackupPoint;
import com.platform.core.governance.backup.repository.BackupPointRepository;
import com.platform.core.governance.domain.enums.GovernanceBackupScope;
import com.platform.core.governance.domain.enums.GovernanceBackupStatus;
import com.platform.core.governance.domain.enums.GovernanceBackupType;
import com.platform.core.governance.domain.enums.GovernanceRestoreDrillStatus;
import com.platform.core.governance.restore.domain.RestoreDrill;
import com.platform.core.governance.restore.repository.RestoreDrillRepository;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * RestoreDrill Controller API 集成测试（D37.17 灾备演练）
 *
 * <p>验证 /api/v1/restore-drills 端点的完整 API 链路：
 * <ul>
 *   <li>GET  /                列表查询（空列表、有数据、状态过滤）</li>
 *   <li>GET  /{id}            详情查询（存在、不存在、跨租户隔离）</li>
 *   <li>POST /                创建灾备演练（返回 201，校验 stepUpToken / operator / backupId / target）</li>
 * </ul>
 *
 * <p>注意：RestoreDrillController.create 不通过 HttpServletRequest 解析 operator，
 * 而是通过请求体 operator 字段传入，因此无 401 测试；stepUpToken 缺失由 DTO @NotBlank 校验返回 400。
 */
@DisplayName("RestoreDrill Controller API 集成测试")
class RestoreDrillControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/restore-drills";

    @Autowired
    private RestoreDrillRepository drillRepository;

    @Autowired
    private BackupPointRepository backupRepository;

    // ── GET 列表查询 ──

    @Test
    @DisplayName("GET /api/v1/restore-drills 空列表应返回 200 + 空 list")
    void shouldReturnEmptyListWhenNoData() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.has("list"), "响应应包含 list 字段"),
                () -> assertEquals(0, data.path("list").size(), "空租户应返回空列表"),
                () -> assertEquals(0, data.path("total").asInt())
        );
    }

    @Test
    @DisplayName("GET /api/v1/restore-drills 有数据时应返回 list 非空")
    void shouldReturnNonEmptyListWhenDataExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        RestoreDrill saved = drillRepository.save(
                buildSampleRestoreDrill(ctx.tenantId(), GovernanceRestoreDrillStatus.COMPLETED));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.path("list").size() >= 1, "应至少有 1 条灾备演练"),
                () -> assertEquals(saved.getId().toString(),
                        data.path("list").get(0).path("id").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/restore-drills?status=COMPLETED 应按状态过滤")
    void shouldFilterByStatus() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        drillRepository.save(
                buildSampleRestoreDrill(ctx.tenantId(), GovernanceRestoreDrillStatus.COMPLETED));
        drillRepository.save(
                buildSampleRestoreDrill(ctx.tenantId(), GovernanceRestoreDrillStatus.RUNNING));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?status=COMPLETED&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 COMPLETED 演练"),
                () -> assertEquals("COMPLETED",
                        data.path("list").get(0).path("status").asText())
        );
    }

    // ── GET 详情查询 ──

    @Test
    @DisplayName("GET /api/v1/restore-drills/{id} 存在的 ID 应返回详情")
    void shouldReturnDetailWhenIdExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        RestoreDrill saved = drillRepository.save(
                buildSampleRestoreDrill(ctx.tenantId(), GovernanceRestoreDrillStatus.COMPLETED));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(saved.getId().toString(), data.path("id").asText()),
                () -> assertEquals(saved.getBackupId().toString(), data.path("backupId").asText()),
                () -> assertEquals("isolated_env", data.path("target").asText()),
                () -> assertEquals("COMPLETED", data.path("status").asText()),
                () -> assertEquals("verifier-001", data.path("verifier").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/restore-drills/{id} 不存在的 ID 应返回 404")
    void shouldReturn404WhenIdNotExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        UUID randomId = UUID.randomUUID();

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + randomId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    @Test
    @DisplayName("GET /api/v1/restore-drills/{id} 跨租户应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        RestoreDrill savedInA = drillRepository.save(
                buildSampleRestoreDrill(ctxA.tenantId(), GovernanceRestoreDrillStatus.COMPLETED));

        // Act（执行）：用租户 B 的 token 查询租户 A 的灾备演练
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctxB.tenantId(), ctxB.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── POST 创建灾备演练 ──

    @Test
    @DisplayName("POST /api/v1/restore-drills 不带 scheduledAt 应创建 RUNNING 状态演练")
    void shouldCreateRunningDrillWithoutScheduledAt() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        UUID backupId = createBackup(ctx.tenantId()).getId();
        String body = """
                {"backupId":"%s","target":"ISOLATED_ENV","operator":"verifier-001","stepUpToken":"valid-token"}
                """.formatted(backupId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertNotNull(data.path("id").asText(), "应返回演练 ID"),
                () -> assertEquals(backupId.toString(), data.path("backupId").asText()),
                () -> assertEquals("isolated_env", data.path("target").asText()),
                () -> assertEquals("RUNNING", data.path("status").asText(),
                        "未指定 scheduledAt 时状态应为 RUNNING"),
                () -> assertEquals("verifier-001", data.path("verifier").asText())
        );
    }

    @Test
    @DisplayName("POST /api/v1/restore-drills 带 scheduledAt 应创建 SCHEDULED 状态演练")
    void shouldCreateScheduledDrillWithScheduledAt() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        UUID backupId = createBackup(ctx.tenantId()).getId();
        String scheduledAt = "2026-08-15T10:00:00Z";
        String body = """
                {"backupId":"%s","target":"PRODUCTION","operator":"verifier-002","scheduledAt":"%s","stepUpToken":"valid-token"}
                """.formatted(backupId, scheduledAt);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("SCHEDULED", data.path("status").asText(),
                        "指定 scheduledAt 时状态应为 SCHEDULED"),
                () -> assertEquals("production", data.path("target").asText())
        );
    }

    @Test
    @DisplayName("POST /api/v1/restore-drills 缺少 stepUpToken 应返回 400")
    void shouldReturn400WhenCreateWithoutStepUpToken() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        UUID backupId = createBackup(ctx.tenantId()).getId();
        String body = """
                {"backupId":"%s","target":"ISOLATED_ENV","operator":"verifier-001"}
                """.formatted(backupId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /api/v1/restore-drills 缺少 operator 应返回 400")
    void shouldReturn400WhenCreateWithoutOperator() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        UUID backupId = createBackup(ctx.tenantId()).getId();
        String body = """
                {"backupId":"%s","target":"ISOLATED_ENV","stepUpToken":"valid-token"}
                """.formatted(backupId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /api/v1/restore-drills 缺少 backupId 应返回 400")
    void shouldReturn400WhenCreateWithoutBackupId() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {"target":"ISOLATED_ENV","operator":"verifier-001","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /api/v1/restore-drills 缺少 target 应返回 400")
    void shouldReturn400WhenCreateWithoutTarget() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        UUID backupId = createBackup(ctx.tenantId()).getId();
        String body = """
                {"backupId":"%s","operator":"verifier-001","stepUpToken":"valid-token"}
                """.formatted(backupId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    // ── 辅助方法 ──

    /**
     * 创建独立测试上下文（租户 + 主体 + access token）
     */
    private TestContext createContext() {
        UUID tenantId = createTestTenant("tenant-rd-api-" + UUID.randomUUID());
        String email = "rd-api+" + UUID.randomUUID() + "@example.com";
        UUID principalId = createTestPrincipal(tenantId, email);
        String token = loginAndGetAccessToken(tenantId, email);
        return new TestContext(tenantId, token, principalId);
    }

    /**
     * 创建测试用 BackupPoint（满足 restore_drill.backup_id 外键约束）
     */
    private BackupPoint createBackup(UUID tenantId) {
        BackupPoint backup = new BackupPoint();
        backup.setTenantId(tenantId);
        backup.setType(GovernanceBackupType.FULL);
        backup.setScope(GovernanceBackupScope.DATABASE);
        backup.setStartedAt(Instant.now().minusSeconds(3600));
        backup.setCompletedAt(Instant.now());
        backup.setDurationSec(3600);
        backup.setSizeBytes(1024L * 1024L * 100L);
        backup.setObjectCount(500);
        backup.setStatus(GovernanceBackupStatus.COMPLETED);
        backup.setActualRpoMin(60);
        backup.setStorageLocation("s3://backups/" + tenantId + "/" + Instant.now().toEpochMilli());
        backup.setHash("sha256-" + UUID.randomUUID());
        backup.setTriggeredBy("admin@example.com");
        return backupRepository.save(backup);
    }

    /**
     * 构造测试用 RestoreDrill，先创建关联 BackupPoint 以满足外键约束
     */
    private RestoreDrill buildSampleRestoreDrill(UUID tenantId, GovernanceRestoreDrillStatus status) {
        BackupPoint backup = createBackup(tenantId);
        RestoreDrill drill = new RestoreDrill();
        drill.setTenantId(tenantId);
        drill.setBackupId(backup.getId());
        drill.setTarget("isolated_env");
        drill.setStatus(status);
        drill.setStartedAt(Instant.now().minusSeconds(3600));
        if (status == GovernanceRestoreDrillStatus.COMPLETED || status == GovernanceRestoreDrillStatus.FAILED) {
            drill.setCompletedAt(Instant.now());
            drill.setActualRtoMin(45);
            drill.setActualRpoMin(30);
            drill.setReportUrl("s3://reports/drill-" + UUID.randomUUID() + ".pdf");
            drill.setPassed(status == GovernanceRestoreDrillStatus.COMPLETED);
            drill.setNotes("测试演练报告");
        }
        drill.setVerifier("verifier-001");
        return drill;
    }

    /**
     * 测试上下文：包含 tenantId、accessToken 和 principalId
     */
    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
