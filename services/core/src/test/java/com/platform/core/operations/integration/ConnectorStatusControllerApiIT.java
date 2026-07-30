package com.platform.core.operations.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.operations.connector.domain.ConnectorStatus;
import com.platform.core.operations.connector.repository.ConnectorStatusRepository;
import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import com.platform.core.operations.domain.enums.ConnectorType;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Connector Controller API 集成测试（D37.17 运营中心）
 *
 * <p>验证 /api/v1/operations/connectors 端点的完整 API 链路：
 * <ul>
 *   <li>GET    /                       列表查询（含 type/status 过滤）</li>
 *   <li>GET    /{id}                   详情查询（存在、不存在、跨租户）</li>
 * </ul>
 *
 * <p>覆盖场景：
 * <ul>
 *   <li>连接器类型过滤（LLM/AI_PROVIDER/MINIO/REVIT/RHINO/SKETCHUP）</li>
 *   <li>健康状态过滤（CONNECTED/DEGRADED/DISCONNECTED/UNKNOWN）</li>
 *   <li>OD-05 ManualHandoff 验证（建筑 AI Provider 强制 isManualHandoff=true）</li>
 *   <li>跨租户隔离</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D44-部署拓扑-Hybrid-Site.md
 */
@DisplayName("Connector Controller API 集成测试")
class ConnectorStatusControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/operations/connectors";

    @Autowired
    private ConnectorStatusRepository connectorStatusRepository;

    // ── GET 列表查询 ──

    @Test
    @DisplayName("GET /api/v1/operations/connectors 空列表应返回 200 + 空 list")
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
    @DisplayName("GET /api/v1/operations/connectors 有数据时应返回 list 非空")
    void shouldReturnNonEmptyListWhenDataExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        connectorStatusRepository.save(buildSampleConnector(
                ctx.tenantId(), "deepseek-llm-001",
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));

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
    @DisplayName("GET /api/v1/operations/connectors?type=LLM 应按类型过滤")
    void shouldFilterByType() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        connectorStatusRepository.save(buildSampleConnector(
                ctx.tenantId(), "deepseek-llm-001",
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));
        connectorStatusRepository.save(buildSampleConnector(
                ctx.tenantId(), "minio-storage-001",
                ConnectorType.MINIO, ConnectorHealthStatus.CONNECTED));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?type=LLM", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 LLM 连接器"),
                () -> assertEquals("LLM", data.path("list").get(0).path("type").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/connectors?status=DEGRADED 应按健康状态过滤")
    void shouldFilterByStatus() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        connectorStatusRepository.save(buildSampleConnector(
                ctx.tenantId(), "deepseek-llm-001",
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));
        connectorStatusRepository.save(buildSampleConnector(
                ctx.tenantId(), "deepseek-llm-002",
                ConnectorType.LLM, ConnectorHealthStatus.DEGRADED));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?status=DEGRADED", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(1, data.path("list").size()),
                () -> assertEquals("DEGRADED", data.path("list").get(0).path("status").asText())
        );
    }

    // ── GET 详情查询 ──

    @Test
    @DisplayName("GET /api/v1/operations/connectors/{id} 存在的 ID 应返回详情")
    void shouldReturnDetailWhenIdExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        ConnectorStatus saved = connectorStatusRepository.save(buildSampleConnector(
                ctx.tenantId(), "deepseek-llm-001",
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));

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
                () -> assertEquals("deepseek-llm-001", data.path("connectorCode").asText()),
                () -> assertEquals("LLM", data.path("type").asText()),
                () -> assertEquals("CONNECTED", data.path("status").asText()),
                () -> assertEquals(1000, data.path("callCount1h").asInt()),
                () -> assertEquals(5, data.path("errorCount1h").asInt()),
                () -> assertEquals(200, data.path("avgLatencyMs").asInt())
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/connectors/{id} OD-05 建筑 AI Provider 应返回 isManualHandoff=true")
    void shouldReturnManualHandoffForAiProvider() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        ConnectorStatus aiProvider = buildSampleConnector(
                ctx.tenantId(), "eviai-001",
                ConnectorType.AI_PROVIDER, ConnectorHealthStatus.UNKNOWN);
        // OD-05 外部 AI V1 约束：建筑 AI Provider 强制 ManualHandoff
        aiProvider.setManualHandoff(true);
        aiProvider.setLicenseRemaining("ManualHandoff: 未获正式 API/许可");
        aiProvider.setEndpointUrl(null);  // 无 API 端点
        connectorStatusRepository.save(aiProvider);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + aiProvider.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）— OD-05 ManualHandoff 红线验证
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("AI_PROVIDER", data.path("type").asText()),
                () -> assertTrue(data.path("isManualHandoff").asBoolean(),
                        "建筑 AI Provider 应强制 isManualHandoff=true（OD-05 约束）"),
                () -> assertEquals("ManualHandoff: 未获正式 API/许可",
                        data.path("licenseRemaining").asText()),
                () -> assertTrue(data.path("endpointUrl").isNull(),
                        "ManualHandoff 模式下 endpointUrl 应为 null（无 API 端点）"),
                () -> assertEquals("UNKNOWN", data.path("status").asText(),
                        "建筑 AI Provider 状态应为 UNKNOWN（未接入）")
        );
    }

    @Test
    @DisplayName("GET /api/v1/operations/connectors/{id} 不存在的 ID 应返回 404")
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
    @DisplayName("GET /api/v1/operations/connectors/{id} 跨租户应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        ConnectorStatus savedInA = connectorStatusRepository.save(buildSampleConnector(
                ctxA.tenantId(), "deepseek-llm-001",
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctxB.tenantId(), ctxB.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── GET 多类型连接器混合查询 ──

    @Test
    @DisplayName("GET /api/v1/operations/connectors 应返回多类型混合连接器")
    void shouldReturnMixedTypeConnectors() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        connectorStatusRepository.save(buildSampleConnector(
                ctx.tenantId(), "deepseek-llm-001",
                ConnectorType.LLM, ConnectorHealthStatus.CONNECTED));
        connectorStatusRepository.save(buildSampleConnector(
                ctx.tenantId(), "minio-storage-001",
                ConnectorType.MINIO, ConnectorHealthStatus.CONNECTED));
        connectorStatusRepository.save(buildSampleConnector(
                ctx.tenantId(), "revit-worker-001",
                ConnectorType.REVIT, ConnectorHealthStatus.CONNECTED));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(3, data.path("list").size(),
                        "应返回 3 条不同类型连接器")
        );
    }

    // ───────────────────────── 工具方法 ─────────────────────────

    private TestContext createContext() {
        UUID tenantId = createTestTenant("tenant-conn-api-" + UUID.randomUUID());
        String email = "conn-api+" + UUID.randomUUID() + "@example.com";
        UUID principalId = createTestPrincipal(tenantId, email);
        String token = loginAndGetAccessToken(tenantId, email);
        return new TestContext(tenantId, token, principalId);
    }

    private HttpHeaders withUserHeaders(TestContext ctx) {
        HttpHeaders headers = withAccessToken(ctx.tenantId(), ctx.accessToken());
        headers.set("x-user-id", ctx.principalId().toString());
        return headers;
    }

    private ConnectorStatus buildSampleConnector(
            UUID tenantId, String connectorCode,
            ConnectorType type, ConnectorHealthStatus status) {
        ConnectorStatus connector = new ConnectorStatus();
        connector.setTenantId(tenantId);
        connector.setConnectorCode(connectorCode);
        connector.setName("连接器-" + connectorCode);
        connector.setType(type);
        connector.setStatus(status);
        connector.setCallCount1h(1000L);
        connector.setErrorCount1h(5L);
        connector.setAvgLatencyMs(200);
        connector.setLicenseRemaining("30 days");
        connector.setLastUsedAt(Instant.now());
        connector.setLastHealthCheckAt(Instant.now());
        connector.setManualHandoff(false);
        connector.setEndpointUrl("https://api.example.com/v1");
        connector.setRegion("us-east-1");
        return connector;
    }

    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
