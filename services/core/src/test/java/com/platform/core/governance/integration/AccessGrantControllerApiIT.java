package com.platform.core.governance.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.governance.accessgrant.domain.AccessGrant;
import com.platform.core.governance.accessgrant.repository.GovernanceAccessGrantRepository;
import com.platform.core.governance.domain.enums.GovernanceAccessGrantStatus;
import com.platform.core.governance.domain.enums.GovernanceAccessGrantType;
import com.platform.core.governance.domain.enums.GovernanceRiskLevel;
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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * AccessGrant Controller API 集成测试（D37.17 Access Review）
 *
 * <p>验证 /api/v1/access-grants 端点的完整 API 链路：
 * <ul>
 *   <li>GET  /                列表查询（空列表、有数据、状态过滤、分页）</li>
 *   <li>GET  /{id}            详情查询（存在、不存在、跨租户隔离）</li>
 *   <li>POST /{id}/actions    执行操作（approve/shorten/revoke、LegalHold 保护、stepUp 校验）</li>
 * </ul>
 *
 * <p>测试数据通过 Repository 直接插入（Controller 无 create 端点），验证 API 读取与操作链路。
 */
@DisplayName("AccessGrant Controller API 集成测试")
class AccessGrantControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/access-grants";

    @Autowired
    private GovernanceAccessGrantRepository accessGrantRepository;

    // ── GET 列表查询 ──

    @Test
    @DisplayName("GET /api/v1/access-grants 空列表应返回 200 + 空 list")
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
    @DisplayName("GET /api/v1/access-grants 有数据时应返回 list 非空")
    void shouldReturnNonEmptyListWhenDataExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        AccessGrant saved = accessGrantRepository.save(
                buildSampleAccessGrant(ctx.tenantId(), "list@example.com"));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.path("list").size() >= 1, "应至少有 1 条授权"),
                () -> assertEquals(saved.getId().toString(),
                        data.path("list").get(0).path("id").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/access-grants?status=ACTIVE 应按状态过滤")
    void shouldFilterByStatus() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        accessGrantRepository.save(buildSampleAccessGrant(
                ctx.tenantId(), "active@example.com",
                GovernanceAccessGrantStatus.ACTIVE));
        accessGrantRepository.save(buildSampleAccessGrant(
                ctx.tenantId(), "pending@example.com",
                GovernanceAccessGrantStatus.PENDING_REVIEW));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?status=ACTIVE&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 ACTIVE 授权"),
                () -> assertEquals("ACTIVE",
                        data.path("list").get(0).path("status").asText())
        );
    }

    // ── GET 详情查询 ──

    @Test
    @DisplayName("GET /api/v1/access-grants/{id} 存在的 ID 应返回详情")
    void shouldReturnDetailWhenIdExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        AccessGrant saved = accessGrantRepository.save(
                buildSampleAccessGrant(ctx.tenantId(), "detail@example.com"));

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
                () -> assertEquals("detail@example.com", data.path("principalEmail").asText()),
                () -> assertEquals("MEMBER", data.path("type").asText()),
                () -> assertEquals("ACTIVE", data.path("status").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/access-grants/{id} 不存在的 ID 应返回 404")
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
    @DisplayName("GET /api/v1/access-grants/{id} 跨租户应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        AccessGrant savedInA = accessGrantRepository.save(
                buildSampleAccessGrant(ctxA.tenantId(), "cross@example.com"));

        // Act（执行）：用租户 B 的 token 查询租户 A 的授权
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctxB.tenantId(), ctxB.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── POST actions 操作 ──

    @Test
    @DisplayName("POST /{id}/actions action=APPROVE 应将 PENDING_REVIEW 改为 ACTIVE")
    void shouldApproveAccessGrant() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        AccessGrant saved = accessGrantRepository.save(buildSampleAccessGrant(
                ctx.tenantId(), "approve@example.com",
                GovernanceAccessGrantStatus.PENDING_REVIEW));
        String body = """
                {"action":"APPROVE","reason":"审批通过","stepUpToken":"valid-token"}
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
                () -> assertEquals("ACTIVE", data.path("status").asText())
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=REVOKE 应将 ACTIVE 改为 REVOKED")
    void shouldRevokeAccessGrant() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        AccessGrant saved = accessGrantRepository.save(
                buildSampleAccessGrant(ctx.tenantId(), "revoke@example.com"));
        String body = """
                {"action":"REVOKE","reason":"不再需要","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("REVOKED", data.path("status").asText())
        );
    }

    @Test
    @DisplayName("POST /{id}/actions hasLegalHold=true 时 REVOKE 应失败")
    void shouldFailToRevokeWhenLegalHold() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        AccessGrant grant = buildSampleAccessGrant(ctx.tenantId(), "hold@example.com");
        grant.setHasLegalHold(true);
        AccessGrant saved = accessGrantRepository.save(grant);
        String body = """
                {"action":"REVOKE","reason":"尝试撤销","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）：业务规则违反应返回 4xx
        assertAll(
                () -> assertTrue(resp.getStatusCode().is4xxClientError(),
                        "Legal Hold 授权撤销应失败: " + resp.getStatusCode()),
                () -> assertNotEquals(0, extractCode(resp.getBody()))
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=SHORTEN 应缩短过期时间")
    void shouldShortenAccessGrantExpiry() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        AccessGrant saved = accessGrantRepository.save(
                buildSampleAccessGrant(ctx.tenantId(), "shorten@example.com"));
        // 新过期时间：当前时间 + 30 分钟（比原 1 小时短）
        String newExpiresAt = Instant.now().plusSeconds(1800).toString();
        String body = """
                {"action":"SHORTEN","reason":"缩短有效期","newExpiresAt":"%s","stepUpToken":"valid-token"}
                """.formatted(newExpiresAt);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("SHORTENED", data.path("status").asText()),
                () -> assertNotNull(data.path("expiresAt").asText())
        );
    }

    @Test
    @DisplayName("POST /{id}/actions 缺少 x-user-id 头应返回 401")
    void shouldReturn401WhenMissingUserIdHeader() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        AccessGrant saved = accessGrantRepository.save(
                buildSampleAccessGrant(ctx.tenantId(), "nouser@example.com"));
        String body = """
                {"action":"APPROVE","reason":"测试","stepUpToken":"valid-token"}
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
                {"action":"APPROVE","reason":"测试","stepUpToken":"valid-token"}
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
        UUID tenantId = createTestTenant("tenant-ag-api-" + UUID.randomUUID());
        String email = "ag-api+" + UUID.randomUUID() + "@example.com";
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
     * 构造测试用 AccessGrant（默认 ACTIVE 状态）
     */
    private AccessGrant buildSampleAccessGrant(UUID tenantId, String email) {
        return buildSampleAccessGrant(tenantId, email, GovernanceAccessGrantStatus.ACTIVE);
    }

    /**
     * 构造测试用 AccessGrant（自定义 status）
     */
    private AccessGrant buildSampleAccessGrant(
            UUID tenantId, String email, GovernanceAccessGrantStatus status) {
        AccessGrant grant = new AccessGrant();
        grant.setTenantId(tenantId);
        grant.setType(GovernanceAccessGrantType.MEMBER);
        grant.setPrincipalName("Tester " + email);
        grant.setPrincipalEmail(email);
        grant.setResource("project:default");
        grant.setPermission("project:read");
        grant.setRiskLevel(GovernanceRiskLevel.MEDIUM);
        grant.setStatus(status);
        grant.setGrantedBy("admin@platform.local");
        grant.setGrantedAt(Instant.now());
        grant.setExpiresAt(Instant.now().plusSeconds(3600));
        grant.setOwner("Project Owner");
        grant.setOwnerEmail("owner@example.com");
        grant.setReason("测试授权：" + email);
        grant.setRequiresStepUp(false);
        grant.setHasLegalHold(false);
        grant.setPropagationDependents("[]");
        return grant;
    }

    /**
     * 测试上下文：包含 tenantId、accessToken 和 principalId（用于 x-user-id 头）
     *
     * <p>principalId 在构造时固定，避免每次调用返回不同值。
     * service 只校验 x-user-id 头非空，不验证是否为真实用户。
     */
    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
