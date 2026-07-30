package com.platform.core.governance.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.governance.auditlog.domain.AuditActor;
import com.platform.core.governance.auditlog.domain.AuditLog;
import com.platform.core.governance.auditlog.domain.AuditObject;
import com.platform.core.governance.auditlog.repository.AuditLogRepository;
import com.platform.core.governance.domain.enums.GovernanceAuditActorType;
import com.platform.core.governance.domain.enums.GovernanceAuditCategory;
import com.platform.core.governance.domain.enums.GovernanceResult;
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
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * AuditLog Controller API 集成测试（D37.17 Audit/Evidence）
 *
 * <p>验证 /api/v1/audit-logs 端点的完整 API 链路：
 * <ul>
 *   <li>GET  /                列表查询（空列表、有数据、category/result/riskLevel/actorId/traceId/时间范围过滤）</li>
 *   <li>GET  /{id}            详情查询（存在、不存在、跨租户隔离）</li>
 * </ul>
 *
 * <p>审计日志只追加，不更新；测试数据通过 Repository 直接插入。
 */
@DisplayName("AuditLog Controller API 集成测试")
class AuditLogControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/audit-logs";

    @Autowired
    private AuditLogRepository auditLogRepository;

    // ── GET 列表查询 ──

    @Test
    @DisplayName("GET /api/v1/audit-logs 空列表应返回 200 + 空 list")
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
    @DisplayName("GET /api/v1/audit-logs 有数据时应返回 list 非空")
    void shouldReturnNonEmptyListWhenDataExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        AuditLog saved = auditLogRepository.save(
                buildSampleAuditLog(ctx.tenantId(), "auth.login", GovernanceAuditCategory.AUTH));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.path("list").size() >= 1, "应至少有 1 条审计日志"),
                () -> assertEquals(saved.getId().toString(),
                        data.path("list").get(0).path("id").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/audit-logs?category=AUTH 应按类别过滤")
    void shouldFilterByCategory() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        auditLogRepository.save(buildSampleAuditLog(
                ctx.tenantId(), "auth.login", GovernanceAuditCategory.AUTH));
        auditLogRepository.save(buildSampleAuditLog(
                ctx.tenantId(), "data.read", GovernanceAuditCategory.DATA));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?category=AUTH&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 AUTH 日志"),
                () -> assertEquals("AUTH",
                        data.path("list").get(0).path("category").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/audit-logs?result=SUCCESS 应按结果过滤")
    void shouldFilterByResult() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        auditLogRepository.save(buildSampleAuditLog(
                ctx.tenantId(), "auth.login.success", GovernanceAuditCategory.AUTH,
                GovernanceResult.SUCCESS));
        auditLogRepository.save(buildSampleAuditLog(
                ctx.tenantId(), "auth.login.failure", GovernanceAuditCategory.AUTH,
                GovernanceResult.FAILURE));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?result=SUCCESS&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 SUCCESS 日志"),
                () -> assertEquals("SUCCESS",
                        data.path("list").get(0).path("result").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/audit-logs?riskLevel=HIGH 应按风险等级过滤")
    void shouldFilterByRiskLevel() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        auditLogRepository.save(buildSampleAuditLog(
                ctx.tenantId(), "release.promote", GovernanceAuditCategory.GOVERNANCE,
                GovernanceResult.SUCCESS, GovernanceRiskLevel.HIGH));
        auditLogRepository.save(buildSampleAuditLog(
                ctx.tenantId(), "data.read", GovernanceAuditCategory.DATA,
                GovernanceResult.SUCCESS, GovernanceRiskLevel.LOW));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?riskLevel=HIGH&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 HIGH 风险日志"),
                () -> assertEquals("HIGH",
                        data.path("list").get(0).path("riskLevel").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/audit-logs?traceId=xxx 应按 traceId 过滤")
    void shouldFilterByTraceId() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        AuditLog saved = auditLogRepository.save(
                buildSampleAuditLog(ctx.tenantId(), "auth.login", GovernanceAuditCategory.AUTH));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?traceId=" + saved.getTraceId() + "&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 traceId 匹配的日志"),
                () -> assertEquals(saved.getTraceId(),
                        data.path("list").get(0).path("traceId").asText())
        );
    }

    // ── GET 详情查询 ──

    @Test
    @DisplayName("GET /api/v1/audit-logs/{id} 存在的 ID 应返回详情")
    void shouldReturnDetailWhenIdExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        AuditLog saved = auditLogRepository.save(
                buildSampleAuditLog(ctx.tenantId(), "auth.login", GovernanceAuditCategory.AUTH));

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
                () -> assertEquals("auth.login", data.path("action").asText()),
                () -> assertEquals("AUTH", data.path("category").asText()),
                () -> assertEquals("SUCCESS", data.path("result").asText()),
                () -> assertTrue(data.path("actor").has("id"), "响应应包含 actor.id"),
                () -> assertTrue(data.path("object").has("type"), "响应应包含 object.type")
        );
    }

    @Test
    @DisplayName("GET /api/v1/audit-logs/{id} 不存在的 ID 应返回 404")
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
    @DisplayName("GET /api/v1/audit-logs/{id} 跨租户应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        AuditLog savedInA = auditLogRepository.save(
                buildSampleAuditLog(ctxA.tenantId(), "auth.login", GovernanceAuditCategory.AUTH));

        // Act（执行）：用租户 B 的 token 查询租户 A 的审计日志
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctxB.tenantId(), ctxB.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── 辅助方法 ──

    /**
     * 创建独立测试上下文（租户 + 主体 + access token）
     */
    private TestContext createContext() {
        UUID tenantId = createTestTenant("tenant-al-api-" + UUID.randomUUID());
        String email = "al-api+" + UUID.randomUUID() + "@example.com";
        UUID principalId = createTestPrincipal(tenantId, email);
        String token = loginAndGetAccessToken(tenantId, email);
        return new TestContext(tenantId, token, principalId);
    }

    /**
     * 构造测试用 AuditLog（默认 SUCCESS/MEDIUM 风险）
     */
    private AuditLog buildSampleAuditLog(UUID tenantId, String action, GovernanceAuditCategory category) {
        return buildSampleAuditLog(tenantId, action, category,
                GovernanceResult.SUCCESS, GovernanceRiskLevel.MEDIUM);
    }

    /**
     * 构造测试用 AuditLog（自定义 result）
     */
    private AuditLog buildSampleAuditLog(
            UUID tenantId, String action, GovernanceAuditCategory category, GovernanceResult result) {
        return buildSampleAuditLog(tenantId, action, category, result, GovernanceRiskLevel.MEDIUM);
    }

    /**
     * 构造测试用 AuditLog（自定义 result + riskLevel）
     */
    private AuditLog buildSampleAuditLog(
            UUID tenantId, String action, GovernanceAuditCategory category,
            GovernanceResult result, GovernanceRiskLevel riskLevel) {
        AuditLog log = new AuditLog();
        log.setTenantId(tenantId);
        log.setTimestamp(Instant.now());
        log.setActor(new AuditActor(
                UUID.randomUUID().toString(),
                "Tester",
                GovernanceAuditActorType.USER));
        log.setAction(action);
        log.setCategory(category);
        log.setObject(new AuditObject(
                "Project", UUID.randomUUID().toString(), "Test Project"));
        log.setTraceId("trace-" + UUID.randomUUID());
        log.setResult(result);
        log.setRiskLevel(riskLevel);
        log.setMasked(true);
        log.setIpAddress("127.0.0.1");
        log.setUserAgent("Test-UA/1.0");
        log.setDetails("{\"key\":\"value\"}");
        return log;
    }

    /**
     * 测试上下文：包含 tenantId、accessToken 和 principalId
     */
    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
