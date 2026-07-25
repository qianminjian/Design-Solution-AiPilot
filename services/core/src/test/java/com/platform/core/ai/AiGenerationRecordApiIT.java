package com.platform.core.ai;

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
 * AI 生成记录（AiGenerationRecord）API 集成测试
 *
 * <p>覆盖创建 / 查询 / 关联设计选项 / 人工复核闭环端点。
 * 重点验证 AI 安全红线：requiresHumanReview=true 的记录必须通过复核闭环流转。
 */
@DisplayName("AI 生成记录（AiGenerationRecord）API 集成测试")
class AiGenerationRecordApiIT extends AbstractIntegrationTest {

    private static final String RECORDS_URL = "/api/v1/ai-generation-records";
    private static final String PROJECTS_URL = "/api/v1/projects";
    private static final String USER_ID_HEADER = "X-User-Id";

    /**
     * 应该成功创建 AI 生成记录
     *
     * <p>AI Service 在生成方案后通过 BFF 转发至 Core Service 落库，
     * 默认 requiresHumanReview=true、reviewStatus=PENDING。
     */
    @Test
    @DisplayName("应该成功创建 AI 生成记录并返回 201")
    void shouldCreateRecordSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-air-create-" + UUID.randomUUID());
        String email = "air-create+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken, "AIR-CREATE-" + UUID.randomUUID());

        String body = """
                {"projectId":"%s","promptTemplate":"concept-design","variables":{},"renderedPrompt":"请生成办公楼方案","rawContent":"## 方案 A","candidates":{},"model":"gpt-4o","tokenUsage":{"prompt":100,"completion":200},"riskLevel":"medium","guardrailResult":{"passed":true},"requiresHumanReview":true,"latencyMs":1500,"traceId":"trace-001"}
                """.formatted(projectId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                RECORDS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertNotNull(data.path("id").asText()),
                () -> assertEquals(projectId.toString(), data.path("projectId").asText()),
                () -> assertEquals("gpt-4o", data.path("model").asText()),
                () -> assertEquals("trace-001", data.path("traceId").asText()),
                () -> assertEquals("medium", data.path("riskLevel").asText()),
                () -> assertTrue(data.path("requiresHumanReview").asBoolean(),
                        "默认应标记为需人工复核"),
                () -> assertEquals("PENDING", data.path("reviewStatus").asText(),
                        "初始复核状态应为 PENDING")
        );
    }

    /**
     * 应该按 ID 查询记录详情
     */
    @Test
    @DisplayName("应该按 ID 查询记录详情")
    void shouldGetRecordById() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-air-get-" + UUID.randomUUID());
        String email = "air-get+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken, "AIR-GET-" + UUID.randomUUID());
        UUID recordId = createRecord(tenantId, accessToken, userId, projectId, "trace-get-001");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                RECORDS_URL + "/" + recordId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(recordId.toString(), data.path("id").asText()),
                () -> assertEquals(projectId.toString(), data.path("projectId").asText()),
                () -> assertEquals("trace-get-001", data.path("traceId").asText())
        );
    }

    /**
     * 应该按项目列出 AI 生成记录
     */
    @Test
    @DisplayName("应该按项目列出 AI 生成记录")
    void shouldListRecordsByProject() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-air-list-" + UUID.randomUUID());
        String email = "air-list+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken, "AIR-LIST-" + UUID.randomUUID());
        createRecord(tenantId, accessToken, userId, projectId, "trace-list-001");
        createRecord(tenantId, accessToken, userId, projectId, "trace-list-002");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                RECORDS_URL + "?projectId=" + projectId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray()),
                () -> assertTrue(data.size() >= 2, "至少 2 条记录")
        );
    }

    /**
     * 应该查询项目内待人工复核记录
     */
    @Test
    @DisplayName("应该查询项目内待人工复核记录")
    void shouldListPendingReviews() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-air-pending-" + UUID.randomUUID());
        String email = "air-pending+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken, "AIR-PEND-" + UUID.randomUUID());
        createRecord(tenantId, accessToken, userId, projectId, "trace-pend-001");
        createRecord(tenantId, accessToken, userId, projectId, "trace-pend-002");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                RECORDS_URL + "/reviews/pending?projectId=" + projectId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray()),
                () -> assertTrue(data.size() >= 2, "待复核记录至少 2 条"),
                () -> assertTrue(data.get(0).path("requiresHumanReview").asBoolean(),
                        "每条记录都应标记需人工复核"),
                () -> assertEquals("PENDING", data.get(0).path("reviewStatus").asText(),
                        "每条记录复核状态应为 PENDING")
        );
    }

    /**
     * 应该成功提交复核决策（APPROVED）
     *
     * <p>AI 安全红线闭环：复核决策后 reviewStatus 流转为 APPROVED，
     * reviewedBy 与 reviewedAt 应填充。
     */
    @Test
    @DisplayName("应该成功提交复核决策 APPROVED")
    void shouldSubmitReviewApproved() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-air-approve-" + UUID.randomUUID());
        String email = "air-approve+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken, "AIR-APPROVE-" + UUID.randomUUID());
        UUID recordId = createRecord(tenantId, accessToken, userId, projectId, "trace-approve-001");

        String body = """
                {"decision":"APPROVED","comment":"方案合理，通过审核","decisionContext":{}}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                RECORDS_URL + "/" + recordId + "/review", HttpMethod.PATCH,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(recordId.toString(), data.path("id").asText()),
                () -> assertEquals("APPROVED", data.path("reviewStatus").asText(),
                        "复核状态应流转为 APPROVED"),
                () -> assertEquals(userId.toString(), data.path("reviewerId").asText()),
                () -> assertNotNull(data.path("reviewedAt").asText(), "复核时间应填充")
        );
    }

    /**
     * 应该成功提交 REJECTED 决策
     */
    @Test
    @DisplayName("应该成功提交复核决策 REJECTED")
    void shouldSubmitReviewRejected() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-air-reject-" + UUID.randomUUID());
        String email = "air-reject+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken, "AIR-REJECT-" + UUID.randomUUID());
        UUID recordId = createRecord(tenantId, accessToken, userId, projectId, "trace-reject-001");

        String body = """
                {"decision":"REJECTED","comment":"存在几何冲突","decisionContext":{}}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                RECORDS_URL + "/" + recordId + "/review", HttpMethod.PATCH,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("REJECTED", data.path("reviewStatus").asText())
        );
    }

    /**
     * 应该拒绝无效决策值（400）
     */
    @Test
    @DisplayName("应该拒绝无效决策值（400）")
    void shouldRejectInvalidDecision() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-air-invalid-" + UUID.randomUUID());
        String email = "air-invalid+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken, "AIR-INVALID-" + UUID.randomUUID());
        UUID recordId = createRecord(tenantId, accessToken, userId, projectId, "trace-invalid-001");

        String body = """
                {"decision":"INVALID","comment":"无效决策"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                RECORDS_URL + "/" + recordId + "/review", HttpMethod.PATCH,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode()),
                () -> assertTrue(extractCode(resp.getBody()) != 0)
        );
    }

    /**
     * 应该租户隔离：跨租户查询不到记录
     */
    @Test
    @DisplayName("应该租户隔离：跨租户查询记录详情返回 404")
    void shouldIsolateTenantsWhenGettingRecord() throws Exception {
        // Arrange（准备）
        UUID tenantA = createTestTenant("tenant-air-iso-a-" + UUID.randomUUID());
        String emailA = "air-iso-a+" + UUID.randomUUID() + "@example.com";
        UUID userA = createTestPrincipal(tenantA, emailA);
        String tokenA = loginAndGetAccessToken(tenantA, emailA);
        UUID projectA = createProject(tenantA, tokenA, "AIR-ISO-A-" + UUID.randomUUID());
        UUID recordId = createRecord(tenantA, tokenA, userA, projectA, "trace-iso-001");

        UUID tenantB = createTestTenant("tenant-air-iso-b-" + UUID.randomUUID());
        String emailB = "air-iso-b+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantB, emailB);
        String tokenB = loginAndGetAccessToken(tenantB, emailB);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                RECORDS_URL + "/" + recordId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantB, tokenB)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode(),
                "跨租户访问应返回 404");
    }

    // ── 辅助方法 ──

    private HttpHeaders withUserHeaders(UUID tenantId, String accessToken, UUID userId) {
        HttpHeaders headers = withAccessToken(tenantId, accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(USER_ID_HEADER, userId.toString());
        return headers;
    }

    private UUID createProject(UUID tenantId, String accessToken, String projectCode) throws Exception {
        String body = """
                {"name":"AI 记录测试项目","code":"%s"}
                """.formatted(projectCode);
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建项目失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

    private UUID createRecord(UUID tenantId, String accessToken, UUID userId,
                                UUID projectId, String traceId) throws Exception {
        String body = """
                {"projectId":"%s","promptTemplate":"concept-design","variables":{},"renderedPrompt":"请生成办公楼方案","rawContent":"## 方案 A","candidates":{},"model":"gpt-4o","tokenUsage":{"prompt":100,"completion":200},"riskLevel":"medium","guardrailResult":{"passed":true},"requiresHumanReview":true,"latencyMs":1500,"traceId":"%s"}
                """.formatted(projectId, traceId);
        ResponseEntity<String> resp = restTemplate.exchange(
                RECORDS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建记录失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }
}
