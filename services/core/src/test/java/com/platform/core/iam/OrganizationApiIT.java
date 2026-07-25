package com.platform.core.iam;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 组织（Organization）API 集成测试
 *
 * <p>覆盖组织 CRUD：创建 / 查询详情 / 分页列表（按 parentId 或顶层）。
 * 通过 TenantResolver 从 JWT 解析租户。
 */
@DisplayName("组织（Organization）API 集成测试")
class OrganizationApiIT extends AbstractIntegrationTest {

    private static final String ORGANIZATIONS_URL = "/api/v1/organizations";

    /**
     * 应该成功创建组织
     */
    @Test
    @DisplayName("应该成功创建组织并返回 201")
    void shouldCreateOrganizationSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-org-create-" + UUID.randomUUID());
        String email = "org-create+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        String body = """
                {"name":"建筑设计院","type":"COMPANY","metadata":{}}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                ORGANIZATIONS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertNotNull(data.path("id").asText()),
                () -> assertEquals("建筑设计院", data.path("name").asText()),
                () -> assertEquals("COMPANY", data.path("type").asText())
        );
    }

    /**
     * 应该按 ID 查询组织
     */
    @Test
    @DisplayName("应该按 ID 查询组织")
    void shouldGetOrganizationById() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-org-get-" + UUID.randomUUID());
        String email = "org-get+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID orgId = createOrganization(tenantId, accessToken, "查询测试组织", "DEPARTMENT");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                ORGANIZATIONS_URL + "/" + orgId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(orgId.toString(), data.path("id").asText()),
                () -> assertEquals("查询测试组织", data.path("name").asText()),
                () -> assertEquals("DEPARTMENT", data.path("type").asText())
        );
    }

    /**
     * 应该分页查询顶层组织
     */
    @Test
    @DisplayName("应该分页查询顶层组织")
    void shouldListTopLevelOrganizations() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-org-list-" + UUID.randomUUID());
        String email = "org-list+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        createOrganization(tenantId, accessToken, "组织 A", "COMPANY");
        createOrganization(tenantId, accessToken, "组织 B", "COMPANY");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                ORGANIZATIONS_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(1, data.path("page").asInt()),
                () -> assertEquals(10, data.path("pageSize").asInt()),
                () -> assertTrue(data.path("total").asLong() >= 2, "顶层组织应 ≥ 2"),
                () -> assertTrue(data.path("list").isArray()),
                () -> assertTrue(data.path("list").size() >= 2)
        );
    }

    /**
     * 应该按 parentId 查询子组织
     */
    @Test
    @DisplayName("应该按 parentId 查询子组织")
    void shouldListChildOrganizations() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-org-child-" + UUID.randomUUID());
        String email = "org-child+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID parentId = createOrganization(tenantId, accessToken, "母公司", "COMPANY");

        createChildOrganization(tenantId, accessToken, parentId, "子公司一");
        createChildOrganization(tenantId, accessToken, parentId, "子公司二");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                ORGANIZATIONS_URL + "?parentId=" + parentId + "&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.path("list").isArray()),
                () -> assertTrue(data.path("list").size() >= 2, "子组织至少 2 条"),
                () -> assertTrue(data.path("total").asLong() >= 2)
        );
    }

    /**
     * 应该租户隔离：跨租户查询组织返回 404
     */
    @Test
    @DisplayName("应该租户隔离：跨租户查询组织返回 404")
    void shouldIsolateTenantsWhenGettingOrganization() throws Exception {
        // Arrange（准备）
        UUID tenantA = createTestTenant("tenant-org-iso-a-" + UUID.randomUUID());
        String emailA = "org-iso-a+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantA, emailA);
        String tokenA = loginAndGetAccessToken(tenantA, emailA);
        UUID orgId = createOrganization(tenantA, tokenA, "租户 A 组织", "COMPANY");

        UUID tenantB = createTestTenant("tenant-org-iso-b-" + UUID.randomUUID());
        String emailB = "org-iso-b+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantB, emailB);
        String tokenB = loginAndGetAccessToken(tenantB, emailB);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                ORGANIZATIONS_URL + "/" + orgId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantB, tokenB)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode(),
                "跨租户访问应返回 404");
    }

    /**
     * 应该拒绝空组织名（400）
     */
    @Test
    @DisplayName("应该拒绝空组织名（400）")
    void shouldRejectEmptyName() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-org-empty-" + UUID.randomUUID());
        String email = "org-empty+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        String body = """
                {"name":"","type":"COMPANY","metadata":{}}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                ORGANIZATIONS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode(),
                "空组织名应返回 400");
    }

    // ── 辅助方法 ──

    private UUID createOrganization(UUID tenantId, String accessToken, String name, String type) throws Exception {
        String body = """
                {"name":"%s","type":"%s","metadata":{}}
                """.formatted(name, type);
        ResponseEntity<String> resp = restTemplate.exchange(
                ORGANIZATIONS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建组织失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

    private UUID createChildOrganization(UUID tenantId, String accessToken,
                                            UUID parentId, String name) throws Exception {
        String body = """
                {"parentId":"%s","name":"%s","type":"DEPARTMENT","metadata":{}}
                """.formatted(parentId, name);
        ResponseEntity<String> resp = restTemplate.exchange(
                ORGANIZATIONS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建子组织失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }
}
