package com.platform.core.operations.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.operations.domain.enums.SloStatus;
import com.platform.core.operations.slo.domain.SloTarget;
import com.platform.core.operations.slo.repository.SloTargetRepository;
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
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * SLO Controller API 集成测试（D37.17 运营中心）
 *
 * <p>验证 /api/v1/operations/slos 端点的完整 API 链路：
 * <ul>
 *   <li>GET    /                       列表查询（含状态过滤）</li>
 *   <li>GET    /{id}                   详情查询（存在、不存在、跨租户）</li>
 *   <li>POST   /                       创建 SLO 目标</li>
 *   <li>PUT    /{id}                   更新 SLO 目标</li>
 * </ul>
 *
 * <p>覆盖场景：
 * <ul>
 *   <li>HEALTHY/WARNING/CRITICAL 状态过滤</li>
 *   <li>BigDecimal 精度保留（availability_target NUMERIC(5,4)）</li>
 *   <li>跨租户隔离</li>
 *   <li>CRITICAL 场景（错误预算 -15.5000 突破）</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D42-SLO-容量.md
 */
@DisplayName("SLO Controller API 集成测试")
class SloTargetControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/operations/slos";

    @Autowired
    private SloTargetRepository sloTargetRepository;

    // ── GET 列表查询 ──

    @Test
    @DisplayName("GET /api/v1/operations/slos 空列表应返回 200 + 空 list")
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
                () -> assertTrue(data.has("list")),
                () -> assertEquals(0, data.path("list").size()),
                () -> assertEquals(0, data.path("total").asInt())
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/slos 有数据时应返回 list 非空")
    void shouldReturnNonEmptyListWhenDataExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        sloTargetRepository.save(buildSampleSlo(
                ctx.tenantId(), "API 可用率", SloStatus.HEALTHY));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.path("list").size() >= 1),
                () -> assertTrue(data.path("total").asInt() >= 1)
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/slos?status=CRITICAL 应按状态过滤")
    void shouldFilterByStatus() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        sloTargetRepository.save(buildSampleSlo(
                ctx.tenantId(), "API 可用率", SloStatus.HEALTHY));
        sloTargetRepository.save(buildSampleSlo(
                ctx.tenantId(), "AI 生成可用率", SloStatus.CRITICAL));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?status=CRITICAL&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 CRITICAL SLO"),
                () -> assertEquals("CRITICAL", data.path("list").get(0).path("status").asText())
        );
    }

    // ── GET 详情查询 ──

    @Test
    @DisplayName("GET /api/v1/operations/slos/{id} 存在的 ID 应返回详情（含 BigDecimal 精度）")
    void shouldReturnDetailWhenIdExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        SloTarget saved = sloTargetRepository.save(buildSampleSlo(
                ctx.tenantId(), "API 可用率", SloStatus.HEALTHY));

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
                () -> assertEquals("API 可用率", data.path("name").asText()),
                () -> assertEquals("HEALTHY", data.path("status").asText()),
                () -> assertEquals("0.9990", data.path("availabilityTarget").asText(),
                        "BigDecimal 精度应保留 4 位小数"),
                () -> assertEquals("0.9995", data.path("availabilityCurrent").asText()),
                () -> assertEquals("100.0000", data.path("errorBudgetRemaining").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/slos/{id} 不存在的 ID 应返回 404")
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
    @DisplayName("GET /api/v1/operations/slos/{id} 跨租户应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        SloTarget savedInA = sloTargetRepository.save(buildSampleSlo(
                ctxA.tenantId(), "API 可用率", SloStatus.HEALTHY));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctxB.tenantId(), ctxB.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── POST 创建 SLO ──

    @Test
    @DisplayName("POST /api/v1/operations/slos 应创建 SLO 目标")
    void shouldCreateSlo() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {
                  "name": "API 可用率",
                  "availabilityTarget": 0.999,
                  "availabilityCurrent": 0.9995,
                  "errorBudgetRemaining": 100.0,
                  "requestCount24h": 100000,
                  "errorCount24h": 50,
                  "p95LatencyMs": 200,
                  "p99LatencyMs": 500,
                  "status": "HEALTHY",
                  "serviceName": "bff-service",
                  "windowDays": 28
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
                () -> assertEquals("API 可用率", data.path("name").asText()),
                () -> assertEquals("HEALTHY", data.path("status").asText()),
                () -> assertEquals("0.9990", data.path("availabilityTarget").asText(),
                        "BigDecimal 精度应保留 4 位小数"),
                () -> assertEquals(28, data.path("windowDays").asInt())
        );
    }

    // ── PUT 更新 SLO ──

    @Test
    @DisplayName("PUT /api/v1/operations/slos/{id} 应更新 SLO 状态（HEALTHY → CRITICAL）")
    void shouldUpdateSloStatus() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        SloTarget saved = sloTargetRepository.save(buildSampleSlo(
                ctx.tenantId(), "API 可用率", SloStatus.HEALTHY));

        String body = """
                {
                  "name": "API 可用率",
                  "availabilityTarget": 0.999,
                  "availabilityCurrent": 0.9850,
                  "errorBudgetRemaining": -15.5,
                  "requestCount24h": 10000,
                  "errorCount24h": 150,
                  "p95LatencyMs": 800,
                  "p99LatencyMs": 1500,
                  "status": "CRITICAL",
                  "serviceName": "bff-service",
                  "windowDays": 28
                }
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId(), HttpMethod.PUT,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("CRITICAL", data.path("status").asText(),
                        "状态应更新为 CRITICAL"),
                () -> assertEquals("-15.5000", data.path("errorBudgetRemaining").asText(),
                        "errorBudgetRemaining 应为 -15.5000（已突破错误预算）"),
                () -> assertEquals("0.9850", data.path("availabilityCurrent").asText(),
                        "availabilityCurrent 应为 0.9850（98.50% 低于 99.9% 目标）"),
                () -> assertEquals(150, data.path("errorCount24h").asInt(),
                        "errorCount24h 应为 150（高错误率）")
        );
    }

    // ── POST 缺少 x-user-id 头 ──

    @Test
    @DisplayName("POST /api/v1/operations/slos 缺少 x-user-id 头应返回 401")
    void shouldReturn401WhenCreateWithoutUserId() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {"name":"测试","availabilityTarget":0.999,"availabilityCurrent":0.9995,
                 "errorBudgetRemaining":100.0,"requestCount24h":1000,"errorCount24h":5,
                 "p95LatencyMs":200,"p99LatencyMs":500,"status":"HEALTHY","windowDays":28}
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
        UUID tenantId = createTestTenant("tenant-slo-api-" + UUID.randomUUID());
        String email = "slo-api+" + UUID.randomUUID() + "@example.com";
        UUID principalId = createTestPrincipal(tenantId, email);
        String token = loginAndGetAccessToken(tenantId, email);
        return new TestContext(tenantId, token, principalId);
    }

    private HttpHeaders withUserHeaders(TestContext ctx) {
        HttpHeaders headers = withAccessToken(ctx.tenantId(), ctx.accessToken());
        headers.set("x-user-id", ctx.principalId().toString());
        return headers;
    }

    private SloTarget buildSampleSlo(UUID tenantId, String name, SloStatus status) {
        SloTarget slo = new SloTarget();
        slo.setTenantId(tenantId);
        slo.setName(name);
        slo.setAvailabilityTarget(new BigDecimal("0.9990"));
        slo.setAvailabilityCurrent(new BigDecimal("0.9995"));
        slo.setErrorBudgetRemaining(new BigDecimal("100.0000"));
        slo.setRequestCount24h(100000L);
        slo.setErrorCount24h(50L);
        slo.setP95LatencyMs(200);
        slo.setP99LatencyMs(500);
        slo.setStatus(status);
        slo.setServiceName("bff-service");
        slo.setWindowDays(28);
        return slo;
    }

    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
