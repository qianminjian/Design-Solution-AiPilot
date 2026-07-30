package com.platform.core.governance.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.governance.domain.enums.GovernanceEvidencePackageStatus;
import com.platform.core.governance.evidence.domain.EvidencePackage;
import com.platform.core.governance.evidence.repository.EvidencePackageRepository;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * EvidencePackage Controller API 集成测试（D37.17 Audit/Evidence 证据包）
 *
 * <p>验证 /api/v1/evidence-packages 端点的完整 API 链路：
 * <ul>
 *   <li>GET  /                列表查询（空列表、有数据、状态过滤）</li>
 *   <li>GET  /{id}            详情查询（存在、不存在、跨租户隔离）</li>
 *   <li>POST /{id}/actions    执行操作（SEAL/VERIFY/EXPORT/CHALLENGE、stepUp 校验）</li>
 * </ul>
 */
@DisplayName("EvidencePackage Controller API 集成测试")
class EvidencePackageControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/evidence-packages";

    @Autowired
    private EvidencePackageRepository packageRepository;

    // ── GET 列表查询 ──

    @Test
    @DisplayName("GET /api/v1/evidence-packages 空列表应返回 200 + 空 list")
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
    @DisplayName("GET /api/v1/evidence-packages 有数据时应返回 list 非空")
    void shouldReturnNonEmptyListWhenDataExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        EvidencePackage saved = packageRepository.save(
                buildSampleEvidencePackage(ctx.tenantId(), "pkg-1"));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.path("list").size() >= 1, "应至少有 1 条证据包"),
                () -> assertEquals(saved.getId().toString(),
                        data.path("list").get(0).path("id").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/evidence-packages?status=DRAFT 应按状态过滤")
    void shouldFilterByStatus() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        packageRepository.save(buildSampleEvidencePackage(
                ctx.tenantId(), "draft-pkg", GovernanceEvidencePackageStatus.DRAFT));
        packageRepository.save(buildSampleEvidencePackage(
                ctx.tenantId(), "sealed-pkg", GovernanceEvidencePackageStatus.SEALED));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?status=DRAFT&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 DRAFT 证据包"),
                () -> assertEquals("DRAFT",
                        data.path("list").get(0).path("status").asText())
        );
    }

    // ── GET 详情查询 ──

    @Test
    @DisplayName("GET /api/v1/evidence-packages/{id} 存在的 ID 应返回详情")
    void shouldReturnDetailWhenIdExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        EvidencePackage saved = packageRepository.save(
                buildSampleEvidencePackage(ctx.tenantId(), "detail-pkg"));

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
                () -> assertEquals("detail-pkg", data.path("name").asText()),
                () -> assertEquals("DRAFT", data.path("status").asText()),
                () -> assertEquals("project", data.path("objectType").asText()),
                () -> assertTrue(data.has("items"), "响应应包含 items 字段")
        );
    }

    @Test
    @DisplayName("GET /api/v1/evidence-packages/{id} 不存在的 ID 应返回 404")
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
    @DisplayName("GET /api/v1/evidence-packages/{id} 跨租户应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        EvidencePackage savedInA = packageRepository.save(
                buildSampleEvidencePackage(ctxA.tenantId(), "cross-pkg"));

        // Act（执行）：用租户 B 的 token 查询租户 A 的证据包
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctxB.tenantId(), ctxB.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── POST actions 操作 ──

    @Test
    @DisplayName("POST /{id}/actions action=SEAL 应将 DRAFT 改为 SEALED")
    void shouldSealEvidencePackage() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        EvidencePackage saved = packageRepository.save(
                buildSampleEvidencePackage(ctx.tenantId(), "seal-pkg"));
        String body = """
                {"action":"SEAL","verifier":"verifier-001","stepUpToken":"valid-token"}
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
                () -> assertEquals("SEALED", data.path("status").asText()),
                () -> assertEquals("verifier-001", data.path("sealedBy").asText()),
                () -> assertNotNull(data.path("sealedAt").asText(), "封存时间应非空")
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=SEAL 缺少 verifier 应返回 422")
    void shouldReturn422WhenSealWithoutVerifier() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        EvidencePackage saved = packageRepository.save(
                buildSampleEvidencePackage(ctx.tenantId(), "seal-no-verifier"));
        String body = """
                {"action":"SEAL","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/actions action=SEAL 缺少 stepUpToken 应返回 403")
    void shouldReturn403WhenSealWithoutStepUp() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        EvidencePackage saved = packageRepository.save(
                buildSampleEvidencePackage(ctx.tenantId(), "seal-no-stepup"));
        String body = """
                {"action":"SEAL","verifier":"verifier-001"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.FORBIDDEN, resp.getStatusCode()),
                () -> assertTrue(packageRepository.findById(saved.getId()).isPresent(),
                        "缺少 stepUpToken 时证据包状态不应变更")
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=SEAL 非 DRAFT 状态应返回 422")
    void shouldReturn422WhenSealNonDraft() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        EvidencePackage pkg = buildSampleEvidencePackage(ctx.tenantId(), "sealed-pkg");
        pkg.setStatus(GovernanceEvidencePackageStatus.SEALED);
        EvidencePackage saved = packageRepository.save(pkg);
        String body = """
                {"action":"SEAL","verifier":"verifier-002","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/actions action=VERIFY 应将 SEALED 改为 VERIFIED")
    void shouldVerifyEvidencePackage() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        EvidencePackage pkg = buildSampleEvidencePackage(ctx.tenantId(), "verify-pkg");
        pkg.setStatus(GovernanceEvidencePackageStatus.SEALED);
        pkg.setSealedBy("sealer-001");
        pkg.setSealedAt(Instant.now());
        EvidencePackage saved = packageRepository.save(pkg);
        String body = """
                {"action":"VERIFY","verifier":"verifier-001","signature":"sig-abc123","stepUpToken":"valid-token"}
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
                () -> assertEquals("VERIFIED", data.path("status").asText()),
                () -> assertEquals("verifier-001", data.path("verifiedBy").asText()),
                () -> assertNotNull(data.path("verifiedAt").asText(), "验证时间应非空")
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=VERIFY 缺少 signature 应返回 422")
    void shouldReturn422WhenVerifyWithoutSignature() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        EvidencePackage pkg = buildSampleEvidencePackage(ctx.tenantId(), "verify-no-sig");
        pkg.setStatus(GovernanceEvidencePackageStatus.SEALED);
        EvidencePackage saved = packageRepository.save(pkg);
        String body = """
                {"action":"VERIFY","verifier":"verifier-001","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/actions action=VERIFY 非 SEALED 状态应返回 422")
    void shouldReturn422WhenVerifyNonSealed() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        // DRAFT 状态直接尝试 VERIFY
        EvidencePackage saved = packageRepository.save(
                buildSampleEvidencePackage(ctx.tenantId(), "verify-draft"));
        String body = """
                {"action":"VERIFY","verifier":"verifier-001","signature":"sig-abc","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/actions action=CHALLENGE 应将 VERIFIED 改为 CHALLENGED")
    void shouldChallengeEvidencePackage() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        EvidencePackage pkg = buildSampleEvidencePackage(ctx.tenantId(), "challenge-pkg");
        pkg.setStatus(GovernanceEvidencePackageStatus.VERIFIED);
        EvidencePackage saved = packageRepository.save(pkg);
        String body = """
                {"action":"CHALLENGE","reason":"数据完整性存疑"}
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
                () -> assertEquals("CHALLENGED", data.path("status").asText())
        );
    }

    @Test
    @DisplayName("POST /{id}/actions action=CHALLENGE 在 DRAFT 状态应返回 422")
    void shouldReturn422WhenChallengeDraft() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        EvidencePackage saved = packageRepository.save(
                buildSampleEvidencePackage(ctx.tenantId(), "challenge-draft"));
        String body = """
                {"action":"CHALLENGE","reason":"尝试质疑 DRAFT"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/actions", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode());
    }

    @Test
    @DisplayName("POST /{id}/actions action=EXPORT 应返回 200 且不改状态")
    void shouldExportEvidencePackage() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        EvidencePackage saved = packageRepository.save(
                buildSampleEvidencePackage(ctx.tenantId(), "export-pkg"));
        String body = """
                {"action":"EXPORT"}
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
                () -> assertEquals("DRAFT", data.path("status").asText(),
                        "EXPORT 不应改变证据包状态")
        );
    }

    @Test
    @DisplayName("POST /{id}/actions 缺少 x-user-id 头应返回 401")
    void shouldReturn401WhenMissingUserIdHeader() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        EvidencePackage saved = packageRepository.save(
                buildSampleEvidencePackage(ctx.tenantId(), "no-user-id-pkg"));
        String body = """
                {"action":"SEAL","verifier":"verifier-001","stepUpToken":"valid-token"}
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
                {"action":"SEAL","verifier":"verifier-001","stepUpToken":"valid-token"}
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
        UUID tenantId = createTestTenant("tenant-ep-api-" + UUID.randomUUID());
        String email = "ep-api+" + UUID.randomUUID() + "@example.com";
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
     * 构造测试用 EvidencePackage（默认 DRAFT 状态）
     */
    private EvidencePackage buildSampleEvidencePackage(UUID tenantId, String name) {
        return buildSampleEvidencePackage(tenantId, name, GovernanceEvidencePackageStatus.DRAFT);
    }

    /**
     * 构造测试用 EvidencePackage（自定义 status）
     */
    private EvidencePackage buildSampleEvidencePackage(
            UUID tenantId, String name, GovernanceEvidencePackageStatus status) {
        EvidencePackage pkg = new EvidencePackage();
        pkg.setTenantId(tenantId);
        pkg.setName(name);
        pkg.setStatus(status);
        pkg.setObjectId(UUID.randomUUID().toString());
        pkg.setObjectType("project");
        pkg.setHash("sha256-" + UUID.randomUUID());
        return pkg;
    }

    /**
     * 测试上下文：包含 tenantId、accessToken 和 principalId（用于 x-user-id 头）
     */
    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
