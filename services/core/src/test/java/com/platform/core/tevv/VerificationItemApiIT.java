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
 * 验证项（VerificationItem）API 集成测试
 *
 * <p>覆盖创建 / 列表 / 状态更新三个端点，验证 PENDING → PASSED / WAIVED 状态流转。
 */
@DisplayName("验证项（VerificationItem）API 集成测试")
class VerificationItemApiIT extends AbstractIntegrationTest {

    private static final String ITEMS_URL = "/api/v1/verification-items";
    private static final String DATASETS_URL = "/api/v1/golden-datasets";
    private static final String USER_ID_HEADER = "X-User-Id";

    /**
     * 应该成功创建验证项
     */
    @Test
    @DisplayName("应该成功创建验证项并返回 201")
    void shouldCreateVerificationItemSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-vi-create-" + UUID.randomUUID());
        String email = "vi-create+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID datasetId = createDataset(tenantId, accessToken, userId, "VI-CREATE 数据集");

        String body = """
                {"datasetId":"%s","itemCode":"CHK-001","title":"几何完整性检查","description":"检查墙闭合性","gateNumber":2,"verificationType":"AUTOMATED","riskLevel":"MEDIUM"}
                """.formatted(datasetId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                ITEMS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertNotNull(data.path("id").asText()),
                () -> assertEquals(datasetId.toString(), data.path("datasetId").asText()),
                () -> assertEquals("CHK-001", data.path("itemCode").asText()),
                () -> assertEquals("几何完整性检查", data.path("title").asText()),
                () -> assertEquals("AUTOMATED", data.path("verificationType").asText()),
                () -> assertEquals("PENDING", data.path("status").asText(),
                        "默认状态应为 PENDING"),
                () -> assertEquals("MEDIUM", data.path("riskLevel").asText())
        );
    }

    /**
     * 应该按数据集列出验证项
     */
    @Test
    @DisplayName("应该按数据集列出验证项")
    void shouldListItemsByDataset() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-vi-list-" + UUID.randomUUID());
        String email = "vi-list+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID datasetId = createDataset(tenantId, accessToken, userId, "VI-LIST 数据集");

        createItem(tenantId, accessToken, userId, datasetId, "CHK-A");
        createItem(tenantId, accessToken, userId, datasetId, "CHK-B");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                ITEMS_URL + "?datasetId=" + datasetId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.isArray()),
                () -> assertTrue(data.size() >= 2, "至少 2 条验证项")
        );
    }

    /**
     * 应该成功更新验证项状态为 PASSED
     */
    @Test
    @DisplayName("应该更新验证项状态为 PASSED（PENDING → PASSED）")
    void shouldUpdateStatusToPassed() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-vi-pass-" + UUID.randomUUID());
        String email = "vi-pass+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID datasetId = createDataset(tenantId, accessToken, userId, "VI-PASS 数据集");
        UUID itemId = createItem(tenantId, accessToken, userId, datasetId, "CHK-P");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                ITEMS_URL + "/" + itemId + "/status?status=PASSED", HttpMethod.PATCH,
                new HttpEntity<>(withUserHeaders(tenantId, accessToken, userId)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(itemId.toString(), data.path("id").asText()),
                () -> assertEquals("PASSED", data.path("status").asText()),
                () -> assertEquals(userId.toString(), data.path("verifiedBy").asText())
        );
    }

    /**
     * 应该成功更新验证项状态为 WAIVED 并记录豁免原因
     */
    @Test
    @DisplayName("应该更新验证项状态为 WAIVED 并记录豁免原因")
    void shouldUpdateStatusToWaivedWithReason() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-vi-waive-" + UUID.randomUUID());
        String email = "vi-waive+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID datasetId = createDataset(tenantId, accessToken, userId, "VI-WAIVE 数据集");
        UUID itemId = createItem(tenantId, accessToken, userId, datasetId, "CHK-W");

        String url = ITEMS_URL + "/" + itemId + "/status?status=WAIVED&waiverReason=非阻断项";

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                url, HttpMethod.PATCH,
                new HttpEntity<>(withUserHeaders(tenantId, accessToken, userId)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("WAIVED", data.path("status").asText()),
                () -> assertEquals("非阻断项", data.path("waiverReason").asText())
        );
    }

    /**
     * 应该租户隔离：跨租户访问验证项列表为空
     */
    @Test
    @DisplayName("应该租户隔离：跨租户查询验证项列表为空")
    void shouldIsolateTenantsWhenListingItems() throws Exception {
        // Arrange（准备）
        UUID tenantA = createTestTenant("tenant-vi-iso-a-" + UUID.randomUUID());
        String emailA = "vi-iso-a+" + UUID.randomUUID() + "@example.com";
        UUID userA = createTestPrincipal(tenantA, emailA);
        String tokenA = loginAndGetAccessToken(tenantA, emailA);
        UUID datasetA = createDataset(tenantA, tokenA, userA, "租户 A 数据集");
        createItem(tenantA, tokenA, userA, datasetA, "ISO-A");

        UUID tenantB = createTestTenant("tenant-vi-iso-b-" + UUID.randomUUID());
        String emailB = "vi-iso-b+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantB, emailB);
        String tokenB = loginAndGetAccessToken(tenantB, emailB);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                ITEMS_URL + "?datasetId=" + datasetA, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantB, tokenB)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray()),
                () -> assertEquals(0, data.size(), "租户 B 不应看到租户 A 的验证项")
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
                {"name":"%s","description":"验证数据集","category":"ARCHITECTURE","buildingType":"OFFICE","storageKey":"s3://bucket/vi-tmp"}
                """.formatted(name);
        ResponseEntity<String> resp = restTemplate.exchange(
                DATASETS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建数据集失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

    private UUID createItem(UUID tenantId, String accessToken, UUID userId,
                             UUID datasetId, String itemCode) throws Exception {
        String body = """
                {"datasetId":"%s","itemCode":"%s","title":"测试检查项","description":"描述","gateNumber":2,"verificationType":"AUTOMATED","riskLevel":"LOW"}
                """.formatted(datasetId, itemCode);
        ResponseEntity<String> resp = restTemplate.exchange(
                ITEMS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建验证项失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }
}
