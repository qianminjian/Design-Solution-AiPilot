package com.platform.core.governance.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.governance.dataasset.domain.DataAsset;
import com.platform.core.governance.dataasset.domain.RetentionPolicy;
import com.platform.core.governance.dataasset.repository.DataAssetRepository;
import com.platform.core.governance.domain.enums.GovernanceDataAssetStatus;
import com.platform.core.governance.domain.enums.GovernanceDataAssetType;
import com.platform.core.governance.domain.enums.GovernanceDataClassification;
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
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * DataAsset Controller API 集成测试（D37.17 Data Governance）
 *
 * <p>验证 /api/v1/data-assets 端点的完整 API 链路：
 * <ul>
 *   <li>GET  /                列表查询（空列表、有数据、状态过滤）</li>
 *   <li>GET  /{id}            详情查询（存在、不存在、跨租户隔离）</li>
 *   <li>POST /{id}/actions    执行操作（HOLD/RELEASE_HOLD/ARCHIVE/DELETE/REPAIR、stepUp 校验）</li>
 * </ul>
 */
@DisplayName("DataAsset Controller API 集成测试")
class DataAssetControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/data-assets";

    @Autowired
    private DataAssetRepository dataAssetRepository;

    // ── GET 列表查询 ──

    @Test
    @DisplayName("GET /api/v1/data-assets 空列表应返回 200 + 空 list")
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
    @DisplayName("GET /api/v1/data-assets 有数据时应返回 list 非空")
    void shouldReturnNonEmptyListWhenDataExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        DataAsset saved = dataAssetRepository.save(
                buildSampleDataAsset(ctx.tenantId(), "dataset-1"));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.path("list").size() >= 1, "应至少有 1 条数据资产"),
                () -> assertEquals(saved.getId().toString(),
                        data.path("list").get(0).path("id").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/data-assets?status=ACTIVE 应按状态过滤")
    void shouldFilterByStatus() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        dataAssetRepository.save(buildSampleDataAsset(
                ctx.tenantId(), "active-asset",
                GovernanceDataAssetStatus.ACTIVE));
        dataAssetRepository.save(buildSampleDataAsset(
                ctx.tenantId(), "archived-asset",
                GovernanceDataAssetStatus.ARCHIVED));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?status=ACTIVE&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 ACTIVE 数据资产"),
                () -> assertEquals("ACTIVE",
                        data.path("list").get(0).path("status").asText())
        );
    }

    // ── GET 详情查询 ──

    @Test
    @DisplayName("GET /api/v1/data-assets/{id} 存在的 ID 应返回详情")
    void shouldReturnDetailWhenIdExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        DataAsset saved = dataAssetRepository.save(
                buildSampleDataAsset(ctx.tenantId(), "detail-asset"));

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
                () -> assertEquals("detail-asset", data.path("name").asText()),
                () -> assertEquals("DATASET", data.path("type").asText()),
                () -> assertEquals("ACTIVE", data.path("status").asText()),
                () -> assertTrue(data.path("retention").has("legalHold"),
                        "响应应包含 retention.legalHold")
        );
    }

    @Test
    @DisplayName("GET /api/v1/data-assets/{id} 不存在的 ID 应返回 404")
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
    @DisplayName("GET /api/v1/data-assets/{id} 跨租户应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        DataAsset savedInA = dataAssetRepository.save(
                buildSampleDataAsset(ctxA.tenantId(), "cross-asset"));

        // Act（执行）：用租户 B 的 token 查询租户 A 的数据资产
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctxB.tenantId(), ctxB.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── POST actions 操作 ──

    @Test
    @DisplayName("POST /{id}/actions action=HOLD 应设置 legalHold=true 并改状态为 HOLD_CONFLICT")
    void shouldHoldDataAsset() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        DataAsset saved = dataAssetRepository.save(
                buildSampleDataAsset(ctx.tenantId(), "hold-asset"));
        String body = """
                {"action":"HOLD","reason":"法律保留","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("HOLD_CONFLICT", data.path("status").asText()),
                () -> assertTrue(data.path("retention").path("legalHold").asBoolean(),
                        "HOLD 后 legalHold 应为 true")
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=RELEASE_HOLD 应解除 legalHold 并恢复 ACTIVE")
    void shouldReleaseHoldDataAsset() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        DataAsset asset = buildSampleDataAsset(ctx.tenantId(), "release-asset");
        asset.setStatus(GovernanceDataAssetStatus.HOLD_CONFLICT);
        asset.setRetention(new RetentionPolicy(7, true, Instant.now().plusSeconds(86400 * 365 * 7)));
        DataAsset saved = dataAssetRepository.save(asset);
        String body = """
                {"action":"RELEASE_HOLD","reason":"解除保留","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("ACTIVE", data.path("status").asText()),
                () -> assertEquals(false, data.path("retention").path("legalHold").asBoolean(),
                        "RELEASE_HOLD 后 legalHold 应为 false")
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=ARCHIVE 应将状态改为 ARCHIVED")
    void shouldArchiveDataAsset() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        DataAsset saved = dataAssetRepository.save(
                buildSampleDataAsset(ctx.tenantId(), "archive-asset"));
        String body = """
                {"action":"ARCHIVE","reason":"归档","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("ARCHIVED", data.path("status").asText())
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=REPAIR 应重置质量指标")
    void shouldRepairDataAsset() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        DataAsset asset = buildSampleDataAsset(ctx.tenantId(), "repair-asset");
        asset.setQualityIssues(5);
        asset.setQualityScore(0.3);
        DataAsset saved = dataAssetRepository.save(asset);
        String body = """
                {"action":"REPAIR","reason":"修复质量问题","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, data.path("qualityIssues").asInt(),
                        "REPAIR 后 qualityIssues 应为 0"),
                () -> assertEquals(1.0, data.path("qualityScore").asDouble(),
                        "REPAIR 后 qualityScore 应为 1.0")
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=DELETE 应物理删除数据资产")
    void shouldDeleteDataAsset() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        DataAsset saved = dataAssetRepository.save(
                buildSampleDataAsset(ctx.tenantId(), "delete-asset"));
        String body = """
                {"action":"DELETE","reason":"永久删除","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(dataAssetRepository.findById(saved.getId()).isEmpty(),
                        "DELETE 后数据资产应已物理删除")
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=DELETE 缺少 stepUpToken 应返回 403")
    void shouldReturn403WhenDeleteWithoutStepUp() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        DataAsset saved = dataAssetRepository.save(
                buildSampleDataAsset(ctx.tenantId(), "no-stepup-asset"));
        String body = """
                {"action":"DELETE","reason":"尝试删除"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.FORBIDDEN, resp.getStatusCode()),
                () -> assertTrue(dataAssetRepository.findById(saved.getId()).isPresent(),
                        "缺少 stepUpToken 时数据资产不应被删除")
        );
    }

    @Test
    @DisplayName("POST /{id}/actions 缺少 x-user-id 头应返回 401")
    void shouldReturn401WhenMissingUserIdHeader() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        DataAsset saved = dataAssetRepository.save(
                buildSampleDataAsset(ctx.tenantId(), "nouser-asset"));
        String body = """
                {"action":"ARCHIVE","reason":"测试","stepUpToken":"valid-token"}
                """;

        // Act（执行）：不携带 x-user-id 头
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/actions 不存在的 ID 应返回 404")
    void shouldReturn404WhenActionOnNonExistentId() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        UUID randomId = UUID.randomUUID();
        String body = """
                {"action":"ARCHIVE","reason":"测试","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + randomId + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── 辅助方法 ──

    /**
     * 创建独立测试上下文（租户 + 主体 + access token）
     */
    private TestContext createContext() {
        UUID tenantId = createTestTenant("tenant-da-api-" + UUID.randomUUID());
        String email = "da-api+" + UUID.randomUUID() + "@example.com";
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
     * 构造测试用 DataAsset（默认 ACTIVE 状态）
     */
    private DataAsset buildSampleDataAsset(UUID tenantId, String name) {
        return buildSampleDataAsset(tenantId, name, GovernanceDataAssetStatus.ACTIVE);
    }

    /**
     * 构造测试用 DataAsset（自定义 status）
     */
    private DataAsset buildSampleDataAsset(
            UUID tenantId, String name, GovernanceDataAssetStatus status) {
        DataAsset asset = new DataAsset();
        asset.setTenantId(tenantId);
        asset.setType(GovernanceDataAssetType.DATASET);
        asset.setName(name);
        asset.setDomain("portfolio");
        asset.setOwner("Data Owner");
        asset.setOwnerEmail("owner@example.com");
        asset.setClassification(GovernanceDataClassification.L3);
        asset.setRetention(new RetentionPolicy(
                7, false, Instant.now().plusSeconds(86400 * 365 * 7)));
        asset.setQualityScore(0.9);
        asset.setQualityIssues(0);
        asset.setLineageCoverage(0.8);
        asset.setStorageLocations("[\"s3://bucket/data\"]");
        asset.setStatus(status);
        asset.setLastModified(Instant.now());
        asset.setDescription("测试数据资产：" + name);
        return asset;
    }

    /**
     * 测试上下文：包含 tenantId、accessToken 和 principalId（用于 x-user-id 头）
     */
    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
