package com.platform.core.operations.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.operations.domain.enums.WorkerRuntimeStatus;
import com.platform.core.operations.domain.enums.WorkerType;
import com.platform.core.operations.worker.domain.WorkerStatus;
import com.platform.core.operations.worker.repository.WorkerStatusRepository;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Worker Controller API 集成测试（D37.17 运营中心）
 *
 * <p>验证 /api/v1/operations/workers 端点的完整 API 链路：
 * <ul>
 *   <li>GET    /                       列表查询（含 type/status/region 过滤）</li>
 *   <li>GET    /{id}                   详情查询（存在、不存在、跨租户）</li>
 *   <li>POST   /{id}/pause             暂停 Worker（RUNNING → STOPPED）</li>
 *   <li>POST   /{id}/resume            恢复 Worker（STOPPED → IDLE）</li>
 * </ul>
 *
 * <p>覆盖场景：
 * <ul>
 *   <li>Worker 类型过滤（AI/RULE/ANALYSIS/INGEST/PUBLICATION）</li>
 *   <li>Hybrid-Site region 过滤（us-east-1/cn-beijing-1）</li>
 *   <li>isCustomerSiteWorker 字段持久化</li>
 *   <li>跨租户隔离</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D44-部署拓扑-Hybrid-Site.md
 */
@DisplayName("Worker Controller API 集成测试")
class WorkerStatusControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/operations/workers";

    @Autowired
    private WorkerStatusRepository workerStatusRepository;

    // ── GET 列表查询 ──

    @Test
    @DisplayName("GET /api/v1/operations/workers 空列表应返回 200 + 空 list")
    void shouldReturnEmptyListWhenNoData() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.has("list")),
                () -> assertEquals(0, data.path("list").size())
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/workers 有数据时应返回 list 非空")
    void shouldReturnNonEmptyListWhenDataExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-api-list-001",
                WorkerType.AI, WorkerRuntimeStatus.IDLE));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.path("list").size() >= 1)
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/workers?type=AI 应按类型过滤")
    void shouldFilterByType() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-type-ai-001",
                WorkerType.AI, WorkerRuntimeStatus.IDLE));
        workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-type-rule-001",
                WorkerType.RULE, WorkerRuntimeStatus.IDLE));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?type=AI", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 AI Worker"),
                () -> assertEquals("AI", data.path("list").get(0).path("type").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/workers?status=RUNNING 应按状态过滤")
    void shouldFilterByStatus() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-status-run-001",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));
        workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-status-idle-001",
                WorkerType.AI, WorkerRuntimeStatus.IDLE));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?status=RUNNING", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(1, data.path("list").size()),
                () -> assertEquals("RUNNING", data.path("list").get(0).path("status").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/workers?region=cn-beijing-1 应按 Hybrid-Site region 过滤")
    void shouldFilterByRegion() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        WorkerStatus workerCn = buildSampleWorker(
                ctx.tenantId(), "worker-region-cn-001",
                WorkerType.AI, WorkerRuntimeStatus.IDLE);
        workerCn.setRegion("cn-beijing-1");
        workerCn.setCustomerSiteWorker(true);
        workerStatusRepository.save(workerCn);

        workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-region-us-001",
                WorkerType.AI, WorkerRuntimeStatus.IDLE));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?region=cn-beijing-1", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(1, data.path("list").size(),
                        "应只返回 1 条 cn-beijing-1 region Worker"),
                () -> assertEquals("cn-beijing-1", data.path("list").get(0).path("region").asText()),
                () -> assertTrue(data.path("list").get(0).path("isCustomerSiteWorker").asBoolean(),
                        "客户站点 Worker 应为 true（Hybrid-Site 部署）")
        );
    }

    // ── GET 详情查询 ──

    @Test
    @DisplayName("GET /api/v1/operations/workers/{id} 存在的 ID 应返回详情")
    void shouldReturnDetailWhenIdExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        WorkerStatus saved = workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-detail-001",
                WorkerType.AI, WorkerRuntimeStatus.IDLE));

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
                () -> assertEquals("worker-detail-001", data.path("workerCode").asText()),
                () -> assertEquals("AI", data.path("type").asText()),
                () -> assertEquals("IDLE", data.path("status").asText()),
                () -> assertEquals("us-east-1", data.path("region").asText()),
                () -> assertEquals("45.50", data.path("cpuPercent").asText(),
                        "BigDecimal 精度应保留"),
                () -> assertEquals(100, data.path("processedCount").asInt())
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/workers/{id} 不存在的 ID 应返回 404")
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
    @DisplayName("GET /api/v1/operations/workers/{id} 跨租户应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        WorkerStatus savedInA = workerStatusRepository.save(buildSampleWorker(
                ctxA.tenantId(), "worker-cross-001",
                WorkerType.AI, WorkerRuntimeStatus.IDLE));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctxB.tenantId(), ctxB.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── POST pause 暂停 Worker ──

    @Test
    @DisplayName("POST /api/v1/operations/workers/{id}/pause RUNNING Worker 应返回 STOPPED")
    void shouldPauseRunningWorker() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-pause-001",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + worker.getId() + "/pause", HttpMethod.POST,
                new HttpEntity<>(withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("STOPPED", data.path("status").asText(),
                        "暂停后状态应为 STOPPED")
        );
    }

    // ── POST resume 恢复 Worker ──

    @Test
    @DisplayName("POST /api/v1/operations/workers/{id}/resume STOPPED Worker 应返回 IDLE")
    void shouldResumeStoppedWorker() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-resume-001",
                WorkerType.AI, WorkerRuntimeStatus.STOPPED));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + worker.getId() + "/resume", HttpMethod.POST,
                new HttpEntity<>(withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("IDLE", data.path("status").asText(),
                        "恢复后状态应为 IDLE")
        );
    }

    // ── POST 缺少 x-user-id 头 ──

    @Test
    @DisplayName("POST /api/v1/operations/workers/{id}/pause 缺少 x-user-id 头应返回 401")
    void shouldReturn401WhenPauseWithoutUserId() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-no-user-001",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        // Act（执行）：不携带 x-user-id 头
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + worker.getId() + "/pause", HttpMethod.POST,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    private TestContext createContext() {
        UUID tenantId = createTestTenant("tenant-worker-api-" + UUID.randomUUID());
        String email = "worker-api+" + UUID.randomUUID() + "@example.com";
        UUID principalId = createTestPrincipal(tenantId, email);
        String token = loginAndGetAccessToken(tenantId, email);
        return new TestContext(tenantId, token, principalId);
    }

    private HttpHeaders withUserHeaders(TestContext ctx) {
        HttpHeaders headers = withAccessToken(ctx.tenantId(), ctx.accessToken());
        headers.set("x-user-id", ctx.principalId().toString());
        return headers;
    }

    private WorkerStatus buildSampleWorker(
            UUID tenantId, String workerCode,
            WorkerType type, WorkerRuntimeStatus status) {
        WorkerStatus worker = new WorkerStatus();
        worker.setTenantId(tenantId);
        worker.setWorkerCode(workerCode);
        worker.setType(type);
        worker.setStatus(status);
        worker.setProcessedCount(100L);
        worker.setFailedCount(0L);
        worker.setAvgDurationSec(30);
        worker.setCpuPercent(new BigDecimal("45.50"));
        worker.setMemoryPercent(new BigDecimal("62.30"));
        worker.setLastHeartbeat(Instant.now());
        worker.setRegion("us-east-1");
        worker.setCustomerSiteWorker(false);
        worker.setIsolated(false);
        return worker;
    }

    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
