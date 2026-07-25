package com.platform.core.compliance;

import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 合规检查 API 集成测试
 *
 * <p>每个测试方法独立创建租户、项目与规则集，确保与其他测试隔离，不依赖 @Order 共享状态。
 */
class ComplianceCheckApiIT extends AbstractIntegrationTest {

    private static final String PROJECTS_URL = "/api/v1/projects";

    @Test
    @DisplayName("应该能创建检查运行")
    void shouldCreateCheckRun() throws Exception {
        TestContext ctx = createContext("create");
        UUID projectId = createProject(ctx);
        UUID ruleSetId = createTestRuleSet(ctx);

        String body = """
                {
                    "projectId": "%s",
                    "ruleSetId": "%s"
                }
                """.formatted(projectId, ruleSetId);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/compliance-checks", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        assertEquals(201, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
        assertTrue(extractData(resp.getBody()).has("id"));
        assertEquals("PENDING", extractData(resp.getBody()).get("status").asText());
    }

    @Test
    @DisplayName("应该能执行检查运行")
    void shouldExecuteCheckRun() throws Exception {
        TestContext ctx = createContext("execute");
        UUID projectId = createProject(ctx);
        UUID ruleSetId = createTestRuleSet(ctx);
        UUID runId = createCheckRun(ctx, projectId, ruleSetId);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/compliance-checks/" + runId + "/execute", HttpMethod.POST,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        assertEquals(200, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
    }

    @Test
    @DisplayName("应该能查询检查运行列表")
    void shouldListCheckRuns() throws Exception {
        TestContext ctx = createContext("list");
        UUID projectId = createProject(ctx);
        UUID ruleSetId = createTestRuleSet(ctx);
        createCheckRun(ctx, projectId, ruleSetId);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/compliance-checks?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        assertEquals(200, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
        assertTrue(extractData(resp.getBody()).has("list"));
        assertTrue(extractData(resp.getBody()).get("list").size() >= 1,
                "列表应至少包含 1 条刚刚创建的运行记录");
    }

    // ── 内部辅助 ──

    private record TestContext(UUID tenantId, String accessToken) {}

    private TestContext createContext(String suffix) {
        UUID tenantId = createTestTenant("compliance-check-" + suffix + "-" + UUID.randomUUID());
        String email = "compliance-check-" + suffix + "+" + UUID.randomUUID() + "@test.com";
        createTestPrincipal(tenantId, email);
        String token = loginAndGetAccessToken(tenantId, email);
        return new TestContext(tenantId, token);
    }

    private UUID createProject(TestContext ctx) throws Exception {
        String body = """
                {"name":"合规检查测试项目","code":"CC-%s"}
                """.formatted(UUID.randomUUID());
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);
        assertEquals(201, resp.getStatusCode().value(), "创建项目失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

    private UUID createTestRuleSet(TestContext ctx) throws Exception {
        String body = """
                {
                    "name": "测试检查规则集-%s",
                    "description": "测试用规则集",
                    "stageCode": "DD",
                    "rules": []
                }
                """.formatted(UUID.randomUUID());

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/rule-sets", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        assertEquals(201, resp.getStatusCode().value(), "创建规则集失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).get("id").asText());
    }

    private UUID createCheckRun(TestContext ctx, UUID projectId, UUID ruleSetId) throws Exception {
        String body = """
                {
                    "projectId": "%s",
                    "ruleSetId": "%s"
                }
                """.formatted(projectId, ruleSetId);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/compliance-checks", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        assertEquals(201, resp.getStatusCode().value(), "创建检查运行失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).get("id").asText());
    }
}
