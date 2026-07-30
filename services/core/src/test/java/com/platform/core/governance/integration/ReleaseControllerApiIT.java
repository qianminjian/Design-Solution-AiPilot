package com.platform.core.governance.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.governance.domain.enums.GovernanceMetricsDrift;
import com.platform.core.governance.domain.enums.GovernanceRedteamStatus;
import com.platform.core.governance.domain.enums.GovernanceReleaseStatus;
import com.platform.core.governance.domain.enums.GovernanceReleaseType;
import com.platform.core.governance.release.domain.Release;
import com.platform.core.governance.release.domain.ReleaseDiffSummary;
import com.platform.core.governance.release.repository.ReleaseRepository;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Release Controller API 集成测试（D37.17 AI/Rule Release）
 *
 * <p>验证 /api/v1/releases 端点的完整 API 链路：
 * <ul>
 *   <li>GET  /                列表查询（空列表、有数据、状态过滤）</li>
 *   <li>GET  /{id}            详情查询（存在、不存在、跨租户隔离）</li>
 *   <li>POST /{id}/actions    执行操作（APPROVE/CANARY/PROMOTE/ROLLBACK/DEPRECATE、stepUp 校验、业务规则保护）</li>
 * </ul>
 *
 * <p>测试数据通过 Repository 直接插入（Controller 无 create 端点），验证 API 读取与操作链路。
 */
@DisplayName("Release Controller API 集成测试")
class ReleaseControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/releases";

    @Autowired
    private ReleaseRepository releaseRepository;

    // ── GET 列表查询 ──

    @Test
    @DisplayName("GET /api/v1/releases 空列表应返回 200 + 空 list")
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
    @DisplayName("GET /api/v1/releases 有数据时应返回 list 非空")
    void shouldReturnNonEmptyListWhenDataExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release saved = releaseRepository.save(
                buildSampleRelease(ctx.tenantId(), "llm-v1", "v1.0.0"));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.path("list").size() >= 1, "应至少有 1 条 Release"),
                () -> assertEquals(saved.getId().toString(),
                        data.path("list").get(0).path("id").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/releases?status=REVIEW 应按状态过滤")
    void shouldFilterByStatus() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        releaseRepository.save(buildSampleRelease(
                ctx.tenantId(), "review-release", "v1.0.0",
                GovernanceReleaseStatus.REVIEW));
        releaseRepository.save(buildSampleRelease(
                ctx.tenantId(), "promoted-release", "v2.0.0",
                GovernanceReleaseStatus.PROMOTED));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?status=REVIEW&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 REVIEW Release"),
                () -> assertEquals("REVIEW",
                        data.path("list").get(0).path("status").asText())
        );
    }

    // ── GET 详情查询 ──

    @Test
    @DisplayName("GET /api/v1/releases/{id} 存在的 ID 应返回详情")
    void shouldReturnDetailWhenIdExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release saved = releaseRepository.save(
                buildSampleRelease(ctx.tenantId(), "detail-release", "v1.0.0"));

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
                () -> assertEquals("detail-release", data.path("name").asText()),
                () -> assertEquals("LLM", data.path("type").asText()),
                () -> assertEquals("v1.0.0", data.path("version").asText()),
                () -> assertEquals("REVIEW", data.path("status").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/releases/{id} 不存在的 ID 应返回 404")
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
    @DisplayName("GET /api/v1/releases/{id} 跨租户应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        Release savedInA = releaseRepository.save(
                buildSampleRelease(ctxA.tenantId(), "cross-release", "v1.0.0"));

        // Act（执行）：用租户 B 的 token 查询租户 A 的 Release
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctxB.tenantId(), ctxB.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── POST actions 操作 ──

    @Test
    @DisplayName("POST /{id}/actions action=APPROVE 应将 REVIEW 改为 CANARY")
    void shouldApproveRelease() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release saved = releaseRepository.save(buildSampleRelease(
                ctx.tenantId(), "approve-release", "v1.0.0",
                GovernanceReleaseStatus.REVIEW));
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
                () -> assertEquals("CANARY", data.path("status").asText()),
                () -> assertTrue(data.path("canaryPercent").asInt() >= 5,
                        "APPROVE 后 canaryPercent 应至少为 5")
        );
    }

    @Test
    @DisplayName("POST /{id}/actions redteamStatus=FAIL 时 APPROVE 应失败")
    void shouldFailToApproveWhenRedteamFail() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release release = buildSampleRelease(
                ctx.tenantId(), "fail-release", "v1.0.0",
                GovernanceReleaseStatus.REVIEW);
        release.setRedteamStatus(GovernanceRedteamStatus.FAIL);
        Release saved = releaseRepository.save(release);
        String body = """
                {"action":"APPROVE","reason":"尝试审批","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertTrue(resp.getStatusCode().is4xxClientError(),
                        "redteam FAIL 时审批应失败: " + resp.getStatusCode()),
                () -> assertNotEquals(0, extractCode(resp.getBody()))
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=CANARY 应调整灰度百分比")
    void shouldAdjustCanaryPercent() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release saved = releaseRepository.save(buildSampleRelease(
                ctx.tenantId(), "canary-release", "v1.0.0",
                GovernanceReleaseStatus.CANARY));
        String body = """
                {"action":"CANARY","reason":"扩大灰度","canaryPercent":50,"stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("CANARY", data.path("status").asText()),
                () -> assertEquals(50, data.path("canaryPercent").asInt())
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=CANARY 缺少 canaryPercent 应失败")
    void shouldFailCanaryWhenMissingCanaryPercent() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release saved = releaseRepository.save(buildSampleRelease(
                ctx.tenantId(), "canary-missing", "v1.0.0",
                GovernanceReleaseStatus.CANARY));
        String body = """
                {"action":"CANARY","reason":"缺少百分比","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertTrue(resp.getStatusCode().is4xxClientError(),
                "缺少 canaryPercent 应失败: " + resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/actions action=PROMOTE 应将 CANARY 改为 PROMOTED")
    void shouldPromoteRelease() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release saved = releaseRepository.save(buildSampleRelease(
                ctx.tenantId(), "promote-release", "v1.0.0",
                GovernanceReleaseStatus.CANARY));
        String body = """
                {"action":"PROMOTE","reason":"灰度成功转全量","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("PROMOTED", data.path("status").asText()),
                () -> assertEquals(100, data.path("canaryPercent").asInt()),
                () -> assertNotNull(data.path("promotedAt").asText(),
                        "PROMOTE 后 promotedAt 应已写入")
        );
    }

    @Test
    @DisplayName("POST /{id}/actions hasEvalGap=true 时 PROMOTE 应失败")
    void shouldFailToPromoteWhenHasEvalGap() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release release = buildSampleRelease(
                ctx.tenantId(), "gap-release", "v1.0.0",
                GovernanceReleaseStatus.CANARY);
        release.setHasEvalGap(true);
        Release saved = releaseRepository.save(release);
        String body = """
                {"action":"PROMOTE","reason":"尝试全量","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertTrue(resp.getStatusCode().is4xxClientError(),
                "hasEvalGap=true 时 PROMOTE 应失败: " + resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/actions metricsDrift=MAJOR 时 PROMOTE 应失败")
    void shouldFailToPromoteWhenMetricsDriftMajor() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release release = buildSampleRelease(
                ctx.tenantId(), "drift-release", "v1.0.0",
                GovernanceReleaseStatus.CANARY);
        release.setMetricsDrift(GovernanceMetricsDrift.MAJOR);
        Release saved = releaseRepository.save(release);
        String body = """
                {"action":"PROMOTE","reason":"尝试全量","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertTrue(resp.getStatusCode().is4xxClientError(),
                "metricsDrift=MAJOR 时 PROMOTE 应失败: " + resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/actions action=PROMOTE 缺少 stepUpToken 应返回 403")
    void shouldReturn403WhenPromoteWithoutStepUp() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release saved = releaseRepository.save(buildSampleRelease(
                ctx.tenantId(), "no-stepup", "v1.0.0",
                GovernanceReleaseStatus.CANARY));
        String body = """
                {"action":"PROMOTE","reason":"缺少 stepUp"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.FORBIDDEN, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/actions action=ROLLBACK 应将 PROMOTED 改为 ROLLED_BACK")
    void shouldRollbackRelease() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release saved = releaseRepository.save(buildSampleRelease(
                ctx.tenantId(), "rollback-release", "v1.0.0",
                GovernanceReleaseStatus.PROMOTED));
        String body = """
                {"action":"ROLLBACK","reason":"生产问题回滚","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("ROLLED_BACK", data.path("status").asText())
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=DEPRECATE 应将 Release 改为 DEPRECATED")
    void shouldDeprecateRelease() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release saved = releaseRepository.save(buildSampleRelease(
                ctx.tenantId(), "deprecate-release", "v1.0.0",
                GovernanceReleaseStatus.PROMOTED));
        String body = """
                {"action":"DEPRECATE","reason":"生命周期结束","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("DEPRECATED", data.path("status").asText())
        );
    }

    @Test
    @DisplayName("POST /{id}/actions 缺少 x-user-id 头应返回 401")
    void shouldReturn401WhenMissingUserIdHeader() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        Release saved = releaseRepository.save(buildSampleRelease(
                ctx.tenantId(), "nouser-release", "v1.0.0",
                GovernanceReleaseStatus.REVIEW));
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
        UUID tenantId = createTestTenant("tenant-rel-api-" + UUID.randomUUID());
        String email = "rel-api+" + UUID.randomUUID() + "@example.com";
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
     * 构造测试用 Release（默认 REVIEW 状态）
     */
    private Release buildSampleRelease(UUID tenantId, String name, String version) {
        return buildSampleRelease(tenantId, name, version, GovernanceReleaseStatus.REVIEW);
    }

    /**
     * 构造测试用 Release（自定义 status）
     */
    private Release buildSampleRelease(
            UUID tenantId, String name, String version, GovernanceReleaseStatus status) {
        Release release = new Release();
        release.setTenantId(tenantId);
        release.setName(name);
        release.setType(GovernanceReleaseType.LLM);
        release.setVersion(version);
        release.setPreviousVersion(null);
        release.setStatus(status);
        release.setReleaseManager("Release Manager " + name);
        release.setPromotedAt(null);
        release.setEvalScore(0.85);
        release.setEvalSlices(10);
        release.setRedteamStatus(GovernanceRedteamStatus.PASS);
        release.setConsumerCount(0);
        release.setCanaryPercent(0);
        release.setMetricsDrift(GovernanceMetricsDrift.NONE);
        release.setHasEvalGap(false);
        release.setHasOldConsumer(false);
        release.setDescription("测试 Release：" + name);
        release.setDiffSummary(new ReleaseDiffSummary(5, 2, 1));
        return release;
    }

    /**
     * 测试上下文：包含 tenantId、accessToken 和 principalId（用于 x-user-id 头）
     *
     * <p>principalId 在构造时固定，避免每次调用返回不同值。
     * service 只校验 x-user-id 头非空且为合法 UUID，不验证是否为真实用户。
     */
    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
