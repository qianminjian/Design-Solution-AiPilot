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
 * 成员关系（Membership）API 集成测试
 *
 * <p>覆盖主体加入组织的成员关系 CRUD：创建 / 查询详情 / 按主体列表。
 * 通过 TenantResolver 从 JWT 解析租户，无需手动 X-Tenant-Id header。
 */
@DisplayName("成员关系（Membership）API 集成测试")
class MembershipApiIT extends AbstractIntegrationTest {

    private static final String MEMBERSHIPS_URL = "/api/v1/memberships";
    private static final String ORGANIZATIONS_URL = "/api/v1/organizations";

    /**
     * 应该成功创建成员关系
     */
    @Test
    @DisplayName("应该成功创建成员关系并返回 201")
    void shouldCreateMembershipSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-mb-create-" + UUID.randomUUID());
        String email = "mb-create+" + UUID.randomUUID() + "@example.com";
        UUID principalId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID organizationId = createOrganization(tenantId, accessToken, "设计一部");

        String body = """
                {"principalId":"%s","organizationId":"%s","role":"DESIGNER"}
                """.formatted(principalId, organizationId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                MEMBERSHIPS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertNotNull(data.path("id").asText()),
                () -> assertEquals(principalId.toString(), data.path("principalId").asText()),
                () -> assertEquals(organizationId.toString(), data.path("organizationId").asText()),
                () -> assertEquals("DESIGNER", data.path("role").asText())
        );
    }

    /**
     * 应该按 ID 查询成员关系
     */
    @Test
    @DisplayName("应该按 ID 查询成员关系")
    void shouldGetMembershipById() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-mb-get-" + UUID.randomUUID());
        String email = "mb-get+" + UUID.randomUUID() + "@example.com";
        UUID principalId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID organizationId = createOrganization(tenantId, accessToken, "查询测试组织");
        UUID membershipId = createMembership(tenantId, accessToken, principalId, organizationId, "REVIEWER");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                MEMBERSHIPS_URL + "/" + membershipId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(membershipId.toString(), data.path("id").asText()),
                () -> assertEquals(principalId.toString(), data.path("principalId").asText()),
                () -> assertEquals("REVIEWER", data.path("role").asText())
        );
    }

    /**
     * 应该按主体查询成员关系列表
     */
    @Test
    @DisplayName("应该按主体查询成员关系列表")
    void shouldListMembershipsByPrincipal() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-mb-list-" + UUID.randomUUID());
        String email = "mb-list+" + UUID.randomUUID() + "@example.com";
        UUID principalId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID orgA = createOrganization(tenantId, accessToken, "组织 A");
        UUID orgB = createOrganization(tenantId, accessToken, "组织 B");
        createMembership(tenantId, accessToken, principalId, orgA, "DESIGNER");
        createMembership(tenantId, accessToken, principalId, orgB, "REVIEWER");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                MEMBERSHIPS_URL + "?principalId=" + principalId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray()),
                () -> assertTrue(data.size() >= 2, "成员关系至少 2 条")
        );
    }

    /**
     * 应该租户隔离：跨租户查询成员关系返回 404
     */
    @Test
    @DisplayName("应该租户隔离：跨租户查询成员关系返回 404")
    void shouldIsolateTenantsWhenGettingMembership() throws Exception {
        // Arrange（准备）
        UUID tenantA = createTestTenant("tenant-mb-iso-a-" + UUID.randomUUID());
        String emailA = "mb-iso-a+" + UUID.randomUUID() + "@example.com";
        UUID principalA = createTestPrincipal(tenantA, emailA);
        String tokenA = loginAndGetAccessToken(tenantA, emailA);
        UUID orgA = createOrganization(tenantA, tokenA, "租户 A 组织");
        UUID membershipId = createMembership(tenantA, tokenA, principalA, orgA, "DESIGNER");

        UUID tenantB = createTestTenant("tenant-mb-iso-b-" + UUID.randomUUID());
        String emailB = "mb-iso-b+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantB, emailB);
        String tokenB = loginAndGetAccessToken(tenantB, emailB);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                MEMBERSHIPS_URL + "/" + membershipId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantB, tokenB)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode(),
                "跨租户访问应返回 404");
    }

    /**
     * 应该拒绝无效请求体（缺少 principalId）
     */
    @Test
    @DisplayName("应该拒绝缺少 principalId 的请求（400）")
    void shouldRejectMissingPrincipalId() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-mb-invalid-" + UUID.randomUUID());
        String email = "mb-invalid+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID organizationId = createOrganization(tenantId, accessToken, "无效测试组织");

        String body = """
                {"organizationId":"%s","role":"DESIGNER"}
                """.formatted(organizationId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                MEMBERSHIPS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode(),
                "缺少 principalId 应返回 400");
    }

    // ── 辅助方法 ──

    private UUID createOrganization(UUID tenantId, String accessToken, String name) throws Exception {
        String body = """
                {"name":"%s","type":"DEPARTMENT","metadata":{}}
                """.formatted(name);
        ResponseEntity<String> resp = restTemplate.exchange(
                ORGANIZATIONS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建组织失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

    private UUID createMembership(UUID tenantId, String accessToken,
                                    UUID principalId, UUID organizationId, String role) throws Exception {
        String body = """
                {"principalId":"%s","organizationId":"%s","role":"%s"}
                """.formatted(principalId, organizationId, role);
        ResponseEntity<String> resp = restTemplate.exchange(
                MEMBERSHIPS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建成员关系失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }
}
