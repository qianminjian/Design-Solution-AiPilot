package com.platform.core.operations.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.operations.action.domain.OperationsAction;
import com.platform.core.operations.action.repository.OperationsActionRepository;
import com.platform.core.operations.domain.enums.OperationsActionStatus;
import com.platform.core.operations.domain.enums.OperationsActionTargetType;
import com.platform.core.operations.domain.enums.OperationsActionType;
import com.platform.core.operations.domain.enums.OperationsRiskLevel;
import com.platform.core.operations.domain.enums.QueueTaskPriority;
import com.platform.core.operations.domain.enums.QueueTaskStatus;
import com.platform.core.operations.domain.enums.QueueTaskType;
import com.platform.core.operations.domain.enums.WorkerRuntimeStatus;
import com.platform.core.operations.domain.enums.WorkerType;
import com.platform.core.operations.queue.domain.QueueTask;
import com.platform.core.operations.queue.repository.QueueTaskRepository;
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
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * OperationsAction Controller API 集成测试（D37.17 §危险动作）
 *
 * <p>验证 /api/v1/operations/action 端点的完整 API 链路：
 * <ul>
 *   <li>POST /              执行危险动作（统一入口，分发 isolate/retry/reconcile/failover/pause/resume/cancel）</li>
 * </ul>
 *
 * <p>覆盖场景：
 * <ul>
 *   <li>LOW 风险（RESUME）：200 + COMPLETED</li>
 *   <li>MEDIUM 风险（RETRY）：200 + COMPLETED</li>
 *   <li>HIGH 风险（ISOLATE）：200 + COMPLETED（含 stepUpToken + 影响预览确认）</li>
 *   <li>IRREVERSIBLE（CANCEL）：200 + COMPLETED（V0 占位双人审批通过）</li>
 *   <li>缺失 stepUpToken：400 + 业务码非 0</li>
 *   <li>缺失影响预览确认：400 + 业务码非 0</li>
 *   <li>无效 targetId：400 + 业务码非 0</li>
 *   <li>跨租户访问：404</li>
 *   <li>缺少 x-user-id 头：401</li>
 *   <li>缺少 access token：401</li>
 *   <li>审计字段持久化：operationId/auditTraceId/initiatedBy/stepUpTokenHash</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17（§危险动作）
 * @design D40-信息-物理安全.md（Step-up 认证）
 */
@DisplayName("OperationsAction Controller API 集成测试")
class OperationsActionControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/operations/action";

    @Autowired
    private OperationsActionRepository operationsActionRepository;

    @Autowired
    private WorkerStatusRepository workerStatusRepository;

    @Autowired
    private QueueTaskRepository queueTaskRepository;

    // ── POST 执行 LOW 风险动作 ──

    @Test
    @DisplayName("POST /api/v1/operations/action LOW 风险（RESUME Worker）应返回 200 + COMPLETED")
    void shouldExecuteLowRiskActionViaApi() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-api-resume-001",
                WorkerType.AI, WorkerRuntimeStatus.STOPPED));

        String body = """
                {
                  "actionType": "RESUME",
                  "targetType": "WORKER",
                  "targetId": "%s",
                  "reason": "API 测试：恢复 Worker（LOW 风险）",
                  "stepUpToken": null,
                  "impactPreviewAcknowledged": false
                }
                """.formatted(worker.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("COMPLETED", data.path("status").asText()),
                () -> assertEquals("RESUME", data.path("actionType").asText()),
                () -> assertEquals(1, data.path("affectedCount").asInt()),
                () -> assertTrue(data.path("operationId").asText().startsWith("OPS-ACT-"),
                        "operationId 应以 OPS-ACT- 前缀"),
                () -> assertNotNull(data.path("auditTraceId").asText()),
                () -> assertNotNull(data.path("completedAt").asText())
        );
    }

    // ── POST 执行 MEDIUM 风险动作 ──

    @Test
    @DisplayName("POST /api/v1/operations/action MEDIUM 风险（RETRY QueueTask）应返回 200 + COMPLETED")
    void shouldExecuteMediumRiskActionViaApi() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        QueueTask failedTask = queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.AI_GENERATION,
                QueueTaskStatus.FAILED, QueueTaskPriority.NORMAL));

        String body = """
                {
                  "actionType": "RETRY",
                  "targetType": "QUEUE_TASK",
                  "targetId": "%s",
                  "reason": "API 测试：重试任务（MEDIUM 风险）",
                  "stepUpToken": null,
                  "impactPreviewAcknowledged": true
                }
                """.formatted(failedTask.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("COMPLETED", data.path("status").asText()),
                () -> assertEquals("RETRY", data.path("actionType").asText())
        );
    }

    @Test
    @DisplayName("POST /api/v1/operations/action MEDIUM 风险未确认影响预览应返回 400")
    void shouldReturn400WhenMediumRiskWithoutImpactPreview() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        QueueTask failedTask = queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.AI_GENERATION,
                QueueTaskStatus.FAILED, QueueTaskPriority.NORMAL));

        String body = """
                {
                  "actionType": "RETRY",
                  "targetType": "QUEUE_TASK",
                  "targetId": "%s",
                  "reason": "未确认影响预览",
                  "impactPreviewAcknowledged": false
                }
                """.formatted(failedTask.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode()),
                () -> assertTrue(extractCode(resp.getBody()) != 0,
                        "业务码应非 0（表示错误）"),
                () -> assertTrue(resp.getBody().contains("impactPreviewAcknowledged"),
                        "错误信息应包含 impactPreviewAcknowledged")
        );
    }

    // ── POST 执行 HIGH 风险动作 ──

    @Test
    @DisplayName("POST /api/v1/operations/action HIGH 风险（ISOLATE Worker）含 stepUpToken 应返回 200")
    void shouldExecuteHighRiskActionViaApi() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-api-isolate-001",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        String body = """
                {
                  "actionType": "ISOLATE",
                  "targetType": "WORKER",
                  "targetId": "%s",
                  "reason": "API 测试：隔离 Worker（HIGH 风险）",
                  "stepUpToken": "step-up-token-api-001",
                  "impactPreviewAcknowledged": true
                }
                """.formatted(worker.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("COMPLETED", data.path("status").asText()),
                () -> assertEquals("ISOLATE", data.path("actionType").asText())
        );

        // 验证审计记录已持久化
        Optional<OperationsAction> saved = operationsActionRepository
                .findByTenantIdAndOperationId(ctx.tenantId(), data.path("operationId").asText());
        assertTrue(saved.isPresent(), "审计记录应已持久化");
        assertEquals(OperationsRiskLevel.HIGH, saved.get().getRiskLevel(),
                "风险等级应为 HIGH");
        assertNotNull(saved.get().getStepUpTokenHash(),
                "stepUpTokenHash 应已持久化（不存储明文）");
    }

    @Test
    @DisplayName("POST /api/v1/operations/action HIGH 风险缺失 stepUpToken 应返回 400")
    void shouldReturn400WhenHighRiskWithoutStepUpToken() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-api-rej-001",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        String body = """
                {
                  "actionType": "ISOLATE",
                  "targetType": "WORKER",
                  "targetId": "%s",
                  "reason": "缺失 stepUpToken",
                  "stepUpToken": null,
                  "impactPreviewAcknowledged": true
                }
                """.formatted(worker.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode()),
                () -> assertTrue(extractCode(resp.getBody()) != 0),
                () -> assertTrue(resp.getBody().contains("stepUpToken"),
                        "错误信息应包含 stepUpToken")
        );
    }

    // ── POST 执行 IRREVERSIBLE 风险动作 ──

    @Test
    @DisplayName("POST /api/v1/operations/action IRREVERSIBLE（CANCEL QueueTask）应返回 200 + COMPLETED")
    void shouldExecuteIrreversibleActionViaApi() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        QueueTask runningTask = queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.PUBLICATION_SEAL,
                QueueTaskStatus.RUNNING, QueueTaskPriority.CRITICAL));

        String body = """
                {
                  "actionType": "CANCEL",
                  "targetType": "QUEUE_TASK",
                  "targetId": "%s",
                  "reason": "API 测试：取消高风险发布签章任务（IRREVERSIBLE）",
                  "stepUpToken": "step-up-token-irreversible-api",
                  "impactPreviewAcknowledged": true
                }
                """.formatted(runningTask.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("COMPLETED", data.path("status").asText()),
                () -> assertEquals("CANCEL", data.path("actionType").asText())
        );

        // 验证审计记录风险等级为 IRREVERSIBLE
        Optional<OperationsAction> saved = operationsActionRepository
                .findByTenantIdAndOperationId(ctx.tenantId(), data.path("operationId").asText());
        assertTrue(saved.isPresent());
        assertEquals(OperationsRiskLevel.IRREVERSIBLE, saved.get().getRiskLevel(),
                "风险等级应为 IRREVERSIBLE");
    }

    // ── POST retry storm 检测 ──

    @Test
    @DisplayName("POST /api/v1/operations/action retry storm 应返回 409 CONFLICT")
    void shouldReturn409WhenRetryStormDetected() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        QueueTask failedTask = queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.AI_GENERATION,
                QueueTaskStatus.FAILED, QueueTaskPriority.NORMAL));
        String targetId = failedTask.getId().toString();

        // 预置 5 条同 target 的 FAILED OperationsAction（触发阈值）
        for (int i = 0; i < 5; i++) {
            operationsActionRepository.save(buildFailedActionForRetryStorm(ctx.tenantId(), targetId));
        }

        String body = """
                {
                  "actionType": "RETRY",
                  "targetType": "QUEUE_TASK",
                  "targetId": "%s",
                  "reason": "触发 retry storm 检测",
                  "impactPreviewAcknowledged": true
                }
                """.formatted(targetId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.CONFLICT, resp.getStatusCode(),
                        "retry storm 应返回 409 CONFLICT"),
                () -> assertTrue(extractCode(resp.getBody()) != 0),
                () -> assertTrue(resp.getBody().contains("retry storm"),
                        "错误信息应包含 retry storm")
        );
    }

    // ── POST 无效 targetId ──

    @Test
    @DisplayName("POST /api/v1/operations/action 无效 targetId（非 UUID）应返回 400")
    void shouldReturn400WhenTargetIdInvalid() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();

        String body = """
                {
                  "actionType": "ISOLATE",
                  "targetType": "WORKER",
                  "targetId": "not-a-uuid",
                  "reason": "测试无效 targetId",
                  "stepUpToken": "step-up-token",
                  "impactPreviewAcknowledged": true
                }
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode()),
                () -> assertTrue(extractCode(resp.getBody()) != 0),
                () -> assertTrue(resp.getBody().contains("targetId"),
                        "错误信息应包含 targetId")
        );
    }

    // ── POST 跨租户访问 ──

    @Test
    @DisplayName("POST /api/v1/operations/action 跨租户访问应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        WorkerStatus workerInA = workerStatusRepository.save(buildSampleWorker(
                ctxA.tenantId(), "worker-cross-001",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        String body = """
                {
                  "actionType": "ISOLATE",
                  "targetType": "WORKER",
                  "targetId": "%s",
                  "reason": "租户 B 试图操作租户 A 的 Worker",
                  "stepUpToken": "step-up-token-cross",
                  "impactPreviewAcknowledged": true
                }
                """.formatted(workerInA.getId());

        // Act（执行）：租户 B 试图操作租户 A 的 Worker
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctxB)), String.class);

        // Assert（断言）— 不暴露资源存在性，返回 404
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── POST 缺少 x-user-id 头 ──

    @Test
    @DisplayName("POST /api/v1/operations/action 缺少 x-user-id 头应返回 401")
    void shouldReturn401WhenWithoutUserIdHeader() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {
                  "actionType": "RESUME",
                  "targetType": "WORKER",
                  "targetId": "00000000-0000-0000-0000-000000000001",
                  "reason": "测试缺少 x-user-id"
                }
                """;

        // Act（执行）：不携带 x-user-id 头
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())),
                String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    // ── POST 缺少 access token ──

    @Test
    @DisplayName("POST /api/v1/operations/action 缺少 access token 应返回 401")
    void shouldReturn401WhenWithoutAccessToken() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {
                  "actionType": "RESUME",
                  "targetType": "WORKER",
                  "targetId": "00000000-0000-0000-0000-000000000001",
                  "reason": "测试缺少 access token"
                }
                """;

        // Act（执行）：不携带 access token，仅含 x-user-id 与 x-tenant-id
        HttpHeaders headers = jsonHeaders(ctx.tenantId());
        headers.set("x-user-id", ctx.principalId().toString());

        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, headers), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    // ── POST 审计字段持久化 ──

    @Test
    @DisplayName("POST /api/v1/operations/action 审计字段应持久化（operationId/auditTraceId/initiatedBy）")
    void shouldPersistAuditFieldsViaApi() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-audit-api-001",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        String body = """
                {
                  "actionType": "ISOLATE",
                  "targetType": "WORKER",
                  "targetId": "%s",
                  "reason": "审计字段持久化测试",
                  "stepUpToken": "step-up-token-audit-api",
                  "impactPreviewAcknowledged": true
                }
                """.formatted(worker.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        String operationId = data.path("operationId").asText();

        Optional<OperationsAction> saved = operationsActionRepository
                .findByTenantIdAndOperationId(ctx.tenantId(), operationId);
        assertTrue(saved.isPresent(), "审计记录应已持久化");
        assertAll(
                () -> assertEquals(ctx.principalId().toString(), saved.get().getInitiatedBy(),
                        "initiatedBy 应从 x-user-id 头解析"),
                () -> assertNotNull(saved.get().getInitiatedAt()),
                () -> assertNotNull(saved.get().getCompletedAt()),
                () -> assertNotNull(saved.get().getAuditTraceId()),
                () -> assertTrue(saved.get().getOperationId().startsWith("OPS-ACT-")),
                () -> assertEquals(OperationsActionStatus.COMPLETED, saved.get().getStatus()),
                () -> assertEquals(1, saved.get().getAffectedCount()),
                () -> assertNotNull(saved.get().getStepUpTokenHash(),
                        "stepUpTokenHash 应已持久化（不存储明文）")
        );
    }

    // ── POST 分发到不同 target 类型 ──

    @Test
    @DisplayName("POST /api/v1/operations/action 分发 PAUSE 到 QueueTask 应返回 200")
    void shouldDispatchPauseToQueueTask() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        QueueTask runningTask = queueTaskRepository.save(buildSampleQueueTask(
                ctx.tenantId(), QueueTaskType.COMPLIANCE_CHECK,
                QueueTaskStatus.RUNNING, QueueTaskPriority.NORMAL));

        String body = """
                {
                  "actionType": "PAUSE",
                  "targetType": "QUEUE_TASK",
                  "targetId": "%s",
                  "reason": "API 测试：暂停任务",
                  "impactPreviewAcknowledged": true
                }
                """.formatted(runningTask.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("COMPLETED", data.path("status").asText()),
                () -> assertEquals("PAUSE", data.path("actionType").asText())
        );
    }

    @Test
    @DisplayName("POST /api/v1/operations/action 分发 FAILOVER 到 Worker 应返回 200")
    void shouldDispatchFailoverToWorker() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        WorkerStatus worker = workerStatusRepository.save(buildSampleWorker(
                ctx.tenantId(), "worker-failover-api-001",
                WorkerType.AI, WorkerRuntimeStatus.RUNNING));

        String body = """
                {
                  "actionType": "FAILOVER",
                  "targetType": "WORKER",
                  "targetId": "%s",
                  "reason": "API 测试：故障转移",
                  "stepUpToken": "step-up-token-failover",
                  "impactPreviewAcknowledged": true
                }
                """.formatted(worker.getId());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("COMPLETED", data.path("status").asText()),
                () -> assertEquals("FAILOVER", data.path("actionType").asText())
        );
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    /**
     * 创建独立测试上下文（租户 + 主体 + access token）
     */
    private TestContext createContext() {
        UUID tenantId = createTestTenant("tenant-ops-api-" + UUID.randomUUID());
        return createContextInTenant(tenantId);
    }

    /**
     * 在已有租户中创建新主体（用于跨租户测试）
     */
    private TestContext createContextInTenant(UUID tenantId) {
        String email = "ops-api+" + UUID.randomUUID() + "@example.com";
        UUID principalId = createTestPrincipal(tenantId, email);
        String token = loginAndGetAccessToken(tenantId, email);
        return new TestContext(tenantId, token, principalId);
    }

    /**
     * 构造带 x-user-id 头的请求头（写操作端点需要）
     */
    private HttpHeaders withUserHeaders(TestContext ctx) {
        HttpHeaders headers = withAccessToken(ctx.tenantId(), ctx.accessToken());
        headers.set("x-user-id", ctx.principalId().toString());
        return headers;
    }

    /**
     * 构建示例 WorkerStatus 实体
     */
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

    /**
     * 构建示例 QueueTask 实体
     */
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

    /**
     * 构建 retry storm 测试用的 FAILED OperationsAction
     */
    private OperationsAction buildFailedActionForRetryStorm(UUID tenantId, String targetId) {
        OperationsAction action = new OperationsAction();
        action.setTenantId(tenantId);
        action.setOperationId("OPS-ACT-STORM-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        action.setActionType(OperationsActionType.RETRY);
        action.setTargetType(OperationsActionTargetType.QUEUE_TASK);
        action.setTargetId(targetId);
        action.setRiskLevel(OperationsRiskLevel.MEDIUM);
        action.setStatus(OperationsActionStatus.FAILED);
        action.setReason("retry storm 测试用：预置 FAILED 记录");
        action.setImpactPreviewAcknowledged(true);
        action.setInitiatedBy("storm-test@platform.com");
        action.setInitiatedAt(Instant.now());
        action.setCompletedAt(Instant.now());
        action.setAffectedCount(0);
        action.setAuditTraceId("trace-storm-" + UUID.randomUUID());
        action.setErrorMessage("OpenAI 429 Too Many Requests");
        return action;
    }

    /**
     * 测试上下文：包含 tenantId、accessToken 和 principalId
     */
    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
