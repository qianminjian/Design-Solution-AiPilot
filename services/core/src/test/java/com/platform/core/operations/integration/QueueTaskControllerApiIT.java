package com.platform.core.operations.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.operations.domain.enums.QueueTaskPriority;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.domain.enums.QueueTaskType;
import com.platform.core.operations.queue.domain.QueueTask;
import com.platform.core.operations.queue.repository.QueueTaskRepository;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
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
 * QueueTask Controller API 集成测试（D37.17 运营中心）
 *
 * <p>验证 /api/v1/operations/queue 端点的完整 API 链路：
 * <ul>
 *   <li>GET    /                       列表查询（含状态/类型/优先级过滤）</li>
 *   <li>GET    /{id}                   详情查询（存在、不存在、跨租户）</li>
 *   <li>POST   /                       创建任务</li>
 *   <li>POST   /{id}/pause             暂停任务（RUNNING → PAUSED）</li>
 *   <li>POST   /{id}/resume            恢复任务（PAUSED → RUNNING）</li>
 *   <li>POST   /{id}/retry             重试任务（FAILED → QUEUED，检测 retry storm）</li>
 *   <li>POST   /{id}/cancel            取消任务（QUEUED/RUNNING → CANCELLED）</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 */
@DisplayName("QueueTask Controller API 集成测试")
class QueueTaskControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/operations/queue";

    @Autowired
    private QueueTaskRepository queueTaskRepository;

    // ── GET 列表查询 ──

    @Test
    @DisplayName("GET /api/v1/operations/queue 空列表应返回 200 + 空 list")
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
                () -> assertTrue(data.has("list"), "响应应包含 list 字段"),
                () -> assertEquals(0, data.path("list").size(), "空租户应返回空列表"),
                () -> assertEquals(0, data.path("total").asInt())
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/queue 有数据时应返回 list 非空")
    void shouldReturnNonEmptyListWhenDataExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.AI_GENERATION,
                QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.path("list").size() >= 1, "应至少有 1 条任务"),
                () -> assertTrue(data.path("total").asInt() >= 1)
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/queue?status=QUEUED 应按状态过滤")
    void shouldFilterByStatus() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.AI_GENERATION,
                QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));
        queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.COMPLIANCE_CHECK,
                QueueTaskStatus.RUNNING, QueueTaskPriority.HIGH));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?status=QUEUED&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 QUEUED 任务"),
                () -> assertEquals("QUEUED", data.path("list").get(0).path("status").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/queue?type=AI_GENERATION 应按类型过滤")
    void shouldFilterByType() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.AI_GENERATION,
                QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));
        queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.COMPLIANCE_CHECK,
                QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?type=AI_GENERATION&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(1, data.path("list").size()),
                () -> assertEquals("AI_GENERATION", data.path("list").get(0).path("type").asText())
        );
    }

    // ── GET 详情查询 ──

    @Test
    @DisplayName("GET /api/v1/operations/queue/{id} 存在的 ID 应返回详情")
    void shouldReturnDetailWhenIdExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        QueueTask saved = queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.AI_GENERATION,
                QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));

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
                () -> assertEquals("AI_GENERATION", data.path("type").asText()),
                () -> assertEquals("QUEUED", data.path("status").asText()),
                () -> assertEquals("NORMAL", data.path("priority").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/queue/{id} 不存在的 ID 应返回 404")
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
    @DisplayName("GET /api/v1/operations/queue/{id} 跨租户应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        QueueTask savedInA = queueTaskRepository.save(buildSampleQueueTask(
                ctxA.tenantId(), QueueTaskType.AI_GENERATION,
                QueueTaskStatus.QUEUED, QueueTaskPriority.NORMAL));

        // Act（执行）：租户 B 试图查询租户 A 的任务
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctxB.tenantId(), ctxB.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── POST 创建任务 ──

    @Test
    @DisplayName("POST /api/v1/operations/queue 应创建任务")
    void shouldCreateQueueTask() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {
                  "type": "AI_GENERATION",
                  "priority": "NORMAL",
                  "payload": {"prompt": "生成办公建筑方案"}
                }
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("AI_GENERATION", data.path("type").asText()),
                () -> assertEquals("NORMAL", data.path("priority").asText()),
                () -> assertEquals("QUEUED", data.path("status").asText(),
                        "新创建任务状态应为 QUEUED"),
                () -> assertEquals(0, data.path("retryCount").asInt(),
                        "新任务 retryCount 应为 0"),
                () -> assertEquals(3, data.path("maxRetries").asInt(),
                        "默认 maxRetries 应为 3")
        );
    }

    // ── POST pause 暂停任务 ──

    @Test
    @DisplayName("POST /api/v1/operations/queue/{id}/pause RUNNING 任务应返回 PAUSED")
    void shouldPauseRunningTask() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        QueueTask runningTask = queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.AI_GENERATION,
                QueueTaskStatus.RUNNING, QueueTaskPriority.NORMAL));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + runningTask.getId() + "/pause", HttpMethod.POST,
                new HttpEntity<>(withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("PAUSED", data.path("status").asText(),
                        "暂停后状态应为 PAUSED")
        );
    }

    // ── POST resume 恢复任务 ──

    @Test
    @DisplayName("POST /api/v1/operations/queue/{id}/resume PAUSED 任务应返回 RUNNING")
    void shouldResumePausedTask() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        QueueTask pausedTask = queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.AI_GENERATION,
                QueueTaskStatus.PAUSED, QueueTaskPriority.NORMAL));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + pausedTask.getId() + "/resume", HttpMethod.POST,
                new HttpEntity<>(withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("RUNNING", data.path("status").asText(),
                        "恢复后状态应为 RUNNING")
        );
    }

    // ── POST retry 重试任务 ──

    @Test
    @DisplayName("POST /api/v1/operations/queue/{id}/retry FAILED 任务应返回 QUEUED + retryCount +1")
    void shouldRetryFailedTask() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        QueueTask failedTask = queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.AI_GENERATION,
                QueueTaskStatus.FAILED, QueueTaskPriority.NORMAL));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + failedTask.getId() + "/retry", HttpMethod.POST,
                new HttpEntity<>(withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("QUEUED", data.path("status").asText(),
                        "重试后状态应为 QUEUED"),
                () -> assertEquals(1, data.path("retryCount").asInt(),
                        "retryCount 应 +1 = 1")
        );
    }

    // ── POST cancel 取消任务 ──

    @Test
    @DisplayName("POST /api/v1/operations/queue/{id}/cancel RUNNING 任务应返回 CANCELLED")
    void shouldCancelRunningTask() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        QueueTask runningTask = queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.AI_GENERATION,
                QueueTaskStatus.RUNNING, QueueTaskPriority.NORMAL));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + runningTask.getId() + "/cancel", HttpMethod.POST,
                new HttpEntity<>(withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("CANCELLED", data.path("status").asText(),
                        "取消后状态应为 CANCELLED"),
                () -> assertNotNull(data.path("completedAt").asText(),
                        "completedAt 应已记录")
        );
    }

    // ── POST 缺少 x-user-id 头 ──

    @Test
    @DisplayName("POST /api/v1/operations/queue 缺少 x-user-id 头应返回 401")
    void shouldReturn401WhenCreateWithoutUserId() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {"type":"AI_GENERATION","priority":"NORMAL","payload":{}}
                """;

        // Act（执行）：不携带 x-user-id 头
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())),
                String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    private TestContext createContext() {
        UUID tenantId = createTestTenant("tenant-queue-api-" + UUID.randomUUID());
        return createContextInTenant(tenantId);
    }

    private TestContext createContextInTenant(UUID tenantId) {
        String email = "queue-api+" + UUID.randomUUID() + "@example.com";
        UUID principalId = createTestPrincipal(tenantId, email);
        String token = loginAndGetAccessToken(tenantId, email);
        return new TestContext(tenantId, token, principalId);
    }

    private HttpHeaders withUserHeaders(TestContext ctx) {
        HttpHeaders headers = withAccessToken(ctx.tenantId(), ctx.accessToken());
        headers.set("x-user-id", ctx.principalId().toString());
        return headers;
    }

    private QueueTask buildSampleQueueTask(
            UUID tenantId, QueueTaskType type,
            QueueTaskStatus status, QueueTaskPriority priority) {
        QueueTask task = new QueueTask();
        task.setTenantId(tenantId);
        task.setType(type);
        task.setStatus(status);
        task.setPriority(priority);
        task.setPayload("API 集成测试任务负载");
        task.setQueuedAt(Instant.now());
        return task;
    }

    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
