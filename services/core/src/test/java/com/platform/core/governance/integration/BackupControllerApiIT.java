package com.platform.core.governance.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.governance.backup.domain.BackupPoint;
import com.platform.core.governance.backup.repository.BackupPointRepository;
import com.platform.core.governance.domain.enums.GovernanceBackupScope;
import com.platform.core.governance.domain.enums.GovernanceBackupStatus;
import com.platform.core.governance.domain.enums.GovernanceBackupType;
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
 * Backup Controller API 集成测试（D37.17 Backup/Restore）
 *
 * <p>验证 /api/v1/backups 端点的完整 API 链路：
 * <ul>
 *   <li>GET  /                列表查询（空列表、有数据、状态过滤）</li>
 *   <li>GET  /{id}            详情查询（存在、不存在、跨租户隔离）</li>
 *   <li>POST /                创建备份（返回 201，需 x-user-id 头）</li>
 *   <li>POST /{id}/restore    执行恢复（PRODUCTION 需 stepUpToken，状态机校验）</li>
 * </ul>
 */
@DisplayName("Backup Controller API 集成测试")
class BackupControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/backups";

    @Autowired
    private BackupPointRepository backupRepository;

    // ── GET 列表查询 ──

    @Test
    @DisplayName("GET /api/v1/backups 空列表应返回 200 + 空 list")
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
    @DisplayName("GET /api/v1/backups 有数据时应返回 list 非空")
    void shouldReturnNonEmptyListWhenDataExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        BackupPoint saved = backupRepository.save(
                buildSampleBackup(ctx.tenantId(), GovernanceBackupStatus.COMPLETED));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.path("list").size() >= 1, "应至少有 1 条备份记录"),
                () -> assertEquals(saved.getId().toString(),
                        data.path("list").get(0).path("id").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/backups?status=COMPLETED 应按状态过滤")
    void shouldFilterByStatus() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        backupRepository.save(buildSampleBackup(ctx.tenantId(), GovernanceBackupStatus.COMPLETED));
        backupRepository.save(buildSampleBackup(ctx.tenantId(), GovernanceBackupStatus.RUNNING));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?status=COMPLETED&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 COMPLETED 备份"),
                () -> assertEquals("COMPLETED",
                        data.path("list").get(0).path("status").asText())
        );
    }

    // ── GET 详情查询 ──

    @Test
    @DisplayName("GET /api/v1/backups/{id} 存在的 ID 应返回详情")
    void shouldReturnDetailWhenIdExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        BackupPoint saved = backupRepository.save(
                buildSampleBackup(ctx.tenantId(), GovernanceBackupStatus.COMPLETED));

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
                () -> assertEquals("FULL", data.path("type").asText()),
                () -> assertEquals("DATABASE", data.path("scope").asText()),
                () -> assertEquals("COMPLETED", data.path("status").asText()),
                () -> assertTrue(data.path("storageLocation").asText().startsWith("s3://"),
                        "存储位置应以 s3:// 开头")
        );
    }

    @Test
    @DisplayName("GET /api/v1/backups/{id} 不存在的 ID 应返回 404")
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
    @DisplayName("GET /api/v1/backups/{id} 跨租户应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        BackupPoint savedInA = backupRepository.save(
                buildSampleBackup(ctxA.tenantId(), GovernanceBackupStatus.COMPLETED));

        // Act（执行）：用租户 B 的 token 查询租户 A 的备份
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctxB.tenantId(), ctxB.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── POST 创建备份 ──

    @Test
    @DisplayName("POST /api/v1/backups 应返回 201 + 创建的备份")
    void shouldCreateBackup() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {"type":"FULL","scope":"DATABASE","reason":"周备份","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertNotNull(data.path("id").asText(), "应返回备份 ID"),
                () -> assertEquals("FULL", data.path("type").asText()),
                () -> assertEquals("DATABASE", data.path("scope").asText()),
                () -> assertEquals("RUNNING", data.path("status").asText(),
                        "新建备份状态应为 RUNNING"),
                () -> assertEquals(ctx.principalId().toString(),
                        data.path("triggeredBy").asText(),
                        "triggeredBy 应为操作者 ID")
        );
    }

    @Test
    @DisplayName("POST /api/v1/backups 缺少 x-user-id 头应返回 401")
    void shouldReturn401WhenCreateWithoutUserIdHeader() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {"type":"FULL","scope":"DATABASE","reason":"测试","stepUpToken":"valid-token"}
                """;

        // Act（执行）：不携带 x-user-id 头
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /api/v1/backups 缺少 reason 字段应返回 400")
    void shouldReturn400WhenCreateWithoutReason() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {"type":"FULL","scope":"DATABASE","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    // ── POST 恢复操作 ──

    @Test
    @DisplayName("POST /{id}/restore target=ISOLATED_ENV 应成功恢复 COMPLETED 备份")
    void shouldRestoreCompletedBackupToIsolatedEnv() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        BackupPoint saved = backupRepository.save(
                buildSampleBackup(ctx.tenantId(), GovernanceBackupStatus.COMPLETED));
        String body = """
                {"backupId":"%s","target":"ISOLATED_ENV","reason":"恢复演练","stepUpToken":"valid-token"}
                """.formatted(saved.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/restore", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(saved.getId().toString(), data.path("id").asText())
        );
    }

    @Test
    @DisplayName("POST /{id}/restore target=PRODUCTION 应成功恢复 VERIFIED 备份")
    void shouldRestoreVerifiedBackupToProduction() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        BackupPoint saved = backupRepository.save(
                buildSampleBackup(ctx.tenantId(), GovernanceBackupStatus.VERIFIED));
        String body = """
                {"backupId":"%s","target":"PRODUCTION","reason":"生产恢复","stepUpToken":"valid-token"}
                """.formatted(saved.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/restore", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("VERIFIED", data.path("status").asText())
        );
    }

    @Test
    @DisplayName("POST /{id}/restore 不存在的 ID 应返回 404")
    void shouldReturn404WhenRestoreNonExistentId() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        UUID randomId = UUID.randomUUID();
        String body = """
                {"backupId":"%s","target":"ISOLATED_ENV","reason":"测试","stepUpToken":"valid-token"}
                """.formatted(randomId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + randomId + "/restore", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/restore 跨租户应返回 404")
    void shouldReturn404WhenRestoreCrossTenant() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        BackupPoint savedInA = backupRepository.save(
                buildSampleBackup(ctxA.tenantId(), GovernanceBackupStatus.COMPLETED));
        String body = """
                {"backupId":"%s","target":"ISOLATED_ENV","reason":"测试","stepUpToken":"valid-token"}
                """.formatted(savedInA.getId());

        // Act（执行）：用租户 B 的 token 恢复租户 A 的备份
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId() + "/restore", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctxB)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/restore 在 RUNNING 状态备份上应返回 422")
    void shouldReturn422WhenRestoreRunningBackup() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        BackupPoint saved = backupRepository.save(
                buildSampleBackup(ctx.tenantId(), GovernanceBackupStatus.RUNNING));
        String body = """
                {"backupId":"%s","target":"ISOLATED_ENV","reason":"尝试恢复运行中备份","stepUpToken":"valid-token"}
                """.formatted(saved.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/restore", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/restore 缺少 x-user-id 头应返回 401")
    void shouldReturn401WhenRestoreWithoutUserIdHeader() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        BackupPoint saved = backupRepository.save(
                buildSampleBackup(ctx.tenantId(), GovernanceBackupStatus.COMPLETED));
        String body = """
                {"backupId":"%s","target":"ISOLATED_ENV","reason":"测试","stepUpToken":"valid-token"}
                """.formatted(saved.getId());

        // Act（执行）：不携带 x-user-id 头
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/restore", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/restore 缺少 stepUpToken 字段应返回 400")
    void shouldReturn400WhenRestoreWithoutStepUpToken() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        BackupPoint saved = backupRepository.save(
                buildSampleBackup(ctx.tenantId(), GovernanceBackupStatus.COMPLETED));
        String body = """
                {"backupId":"%s","target":"ISOLATED_ENV","reason":"测试"}
                """.formatted(saved.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/restore", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    // ── 辅助方法 ──

    /**
     * 创建独立测试上下文（租户 + 主体 + access token）
     */
    private TestContext createContext() {
        UUID tenantId = createTestTenant("tenant-bk-api-" + UUID.randomUUID());
        String email = "bk-api+" + UUID.randomUUID() + "@example.com";
        UUID principalId = createTestPrincipal(tenantId, email);
        String token = loginAndGetAccessToken(tenantId, email);
        return new TestContext(tenantId, token, principalId);
    }

    /**
     * 构造带 x-user-id 头的请求头（actions 端点需要）
     */
    private org.springframework.http.HttpHeaders withUserHeaders(TestContext ctx) {
        org.springframework.http.HttpHeaders headers = withAccessToken(ctx.tenantId(), ctx.accessToken());
        headers.set("x-user-id", ctx.principalId().toString());
        return headers;
    }

    /**
     * 构造测试用 BackupPoint
     */
    private BackupPoint buildSampleBackup(UUID tenantId, GovernanceBackupStatus status) {
        BackupPoint backup = new BackupPoint();
        backup.setTenantId(tenantId);
        backup.setType(GovernanceBackupType.FULL);
        backup.setScope(GovernanceBackupScope.DATABASE);
        backup.setStartedAt(Instant.now().minusSeconds(3600));
        if (status != GovernanceBackupStatus.RUNNING) {
            backup.setCompletedAt(Instant.now());
            backup.setDurationSec(3600);
        }
        backup.setSizeBytes(1024 * 1024 * 100L);
        backup.setObjectCount(500);
        backup.setStatus(status);
        backup.setActualRpoMin(60);
        backup.setStorageLocation("s3://backups/" + tenantId + "/database/" + Instant.now().toEpochMilli());
        backup.setHash("sha256-" + UUID.randomUUID());
        backup.setTriggeredBy("admin@example.com");
        return backup;
    }

    /**
     * 测试上下文：包含 tenantId、accessToken 和 principalId（用于 x-user-id 头）
     */
    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
