package com.platform.core.tevv;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 金样数据集（GoldenDataset）API 集成测试
 *
 * <p>覆盖创建 / 列表 / 冻结三个端点，验证 DRAFT → FROZEN 状态流转。
 * 所有端点均需 X-Tenant-Id + X-User-Id + Bearer token。
 */
@DisplayName("金样数据集（GoldenDataset）API 集成测试")
class GoldenDatasetApiIT extends AbstractIntegrationTest {

    private static final String DATASETS_URL = "/api/v1/golden-datasets";
    private static final String USER_ID_HEADER = "X-User-Id";

    /**
     * 应该成功创建金样数据集
     *
     * <p>新建数据集默认状态为 DRAFT。
     */
    @Test
    @DisplayName("应该成功创建金样数据集并返回 201")
    void shouldCreateDatasetSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-gd-create-" + UUID.randomUUID());
        String email = "gd-create+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        String body = """
                {"name":"办公楼金样集","description":"V1 验证集","category":"ARCHITECTURE","buildingType":"OFFICE","storageKey":"s3://bucket/gd-001"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                DATASETS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertNotNull(data.path("id").asText()),
                () -> assertEquals("办公楼金样集", data.path("name").asText()),
                () -> assertEquals("V1 验证集", data.path("description").asText()),
                () -> assertEquals("ARCHITECTURE", data.path("category").asText()),
                () -> assertEquals("OFFICE", data.path("buildingType").asText()),
                () -> assertEquals("DRAFT", data.path("status").asText(),
                        "默认状态应为 DRAFT"),
                () -> assertEquals(userId.toString(), data.path("createdBy").asText())
        );
    }

    /**
     * 应该按租户列出金样数据集
     */
    @Test
    @DisplayName("应该按租户列出金样数据集")
    void shouldListDatasetsByTenant() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-gd-list-" + UUID.randomUUID());
        String email = "gd-list+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        createDataset(tenantId, accessToken, userId, "数据集一");
        createDataset(tenantId, accessToken, userId, "数据集二");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                DATASETS_URL, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.isArray()),
                () -> assertTrue(data.size() >= 2, "至少 2 条数据集")
        );
    }

    /**
     * 应该成功冻结 DRAFT 数据集
     *
     * <p>DRAFT → FROZEN 状态流转，冻结后 frozenAt 与 frozenBy 应填充。
     */
    @Test
    @DisplayName("应该成功冻结 DRAFT 数据集（DRAFT → FROZEN）")
    void shouldFreezeDraftDataset() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-gd-freeze-" + UUID.randomUUID());
        String email = "gd-freeze+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID datasetId = createDataset(tenantId, accessToken, userId, "待冻结数据集");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                DATASETS_URL + "/" + datasetId + "/freeze", HttpMethod.POST,
                new HttpEntity<>(withUserHeaders(tenantId, accessToken, userId)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(datasetId.toString(), data.path("id").asText()),
                () -> assertEquals("FROZEN", data.path("status").asText(),
                        "状态应流转为 FROZEN"),
                () -> assertEquals(userId.toString(), data.path("frozenBy").asText()),
                () -> assertNotNull(data.path("frozenAt").asText(), "冻结时间应填充")
        );
    }

    /**
     * 应该租户隔离：跨租户查询不到数据集
     */
    @Test
    @DisplayName("应该租户隔离：跨租户查询数据集列表为空")
    void shouldIsolateTenantsWhenListing() throws Exception {
        // Arrange（准备）
        // 租户 A 创建数据集
        UUID tenantA = createTestTenant("tenant-gd-iso-a-" + UUID.randomUUID());
        String emailA = "gd-iso-a+" + UUID.randomUUID() + "@example.com";
        UUID userA = createTestPrincipal(tenantA, emailA);
        String tokenA = loginAndGetAccessToken(tenantA, emailA);
        createDataset(tenantA, tokenA, userA, "租户 A 数据集");

        // 租户 B 查询
        UUID tenantB = createTestTenant("tenant-gd-iso-b-" + UUID.randomUUID());
        String emailB = "gd-iso-b+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantB, emailB);
        String tokenB = loginAndGetAccessToken(tenantB, emailB);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                DATASETS_URL, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantB, tokenB)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray()),
                () -> assertEquals(0, data.size(), "租户 B 不应看到租户 A 的数据集")
        );
    }

    // ── 辅助方法 ──

    private HttpHeaders withUserHeaders(UUID tenantId, String accessToken, UUID userId) {
        HttpHeaders headers = withAccessToken(tenantId, accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(USER_ID_HEADER, userId.toString());
        return headers;
    }

    private UUID createDataset(UUID tenantId, String accessToken, UUID userId, String name) throws Exception {
        String body = """
                {"name":"%s","description":"测试数据集","category":"ARCHITECTURE","buildingType":"OFFICE","storageKey":"s3://bucket/gd-tmp"}
                """.formatted(name);
        ResponseEntity<String> resp = restTemplate.exchange(
                DATASETS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建数据集失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }
}
