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
 * 规则集 API 集成测试
 *
 * <p>每个测试方法独立创建租户与规则集，确保与其他测试隔离，不依赖 @Order 共享状态。
 */
class RuleSetApiIT extends AbstractIntegrationTest {

    /**
     * 创建测试租户、用户并登录获取 access token，返回上下文对象。
     */
    private TestContext createContext(String suffix) {
        UUID tenantId = createTestTenant("rule-set-" + suffix + "-" + UUID.randomUUID());
        String email = "rule-set-" + suffix + "+" + UUID.randomUUID() + "@test.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        return new TestContext(tenantId, accessToken);
    }

    @Test
    @DisplayName("应该能创建规则集")
    void shouldCreateRuleSet() throws Exception {
        TestContext ctx = createContext("create");

        String body = """
                {
                    "name": "方案设计合规检查规则集",
                    "description": "适用于方案设计阶段的合规检查规则",
                    "stageCode": "SD",
                    "rules": []
                }
                """;

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/rule-sets", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        assertEquals(201, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
        assertTrue(extractData(resp.getBody()).has("id"));
        assertEquals("方案设计合规检查规则集", extractData(resp.getBody()).get("name").asText());
        assertEquals("SD", extractData(resp.getBody()).get("stageCode").asText());
        assertEquals("DRAFT", extractData(resp.getBody()).get("status").asText());
    }

    @Test
    @DisplayName("应该能查询规则集列表")
    void shouldListRuleSets() throws Exception {
        TestContext ctx = createContext("list");
        createRuleSet(ctx, "列表查询规则集");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/rule-sets?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        assertEquals(200, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
        assertTrue(extractData(resp.getBody()).has("list"));
    }

    @Test
    @DisplayName("应该能按阶段筛选规则集")
    void shouldFilterRuleSetsByStage() throws Exception {
        TestContext ctx = createContext("filter");
        createRuleSet(ctx, "阶段筛选规则集");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/rule-sets?stageCode=SD", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        assertEquals(200, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
    }

    @Test
    @DisplayName("应该拒绝重复的规则集名称")
    void shouldRejectDuplicateRuleSetName() throws Exception {
        TestContext ctx = createContext("dup");
        createRuleSet(ctx, "重复名称规则集");

        String body = """
                {
                    "name": "重复名称规则集",
                    "description": "重复名称",
                    "stageCode": "SD"
                }
                """;

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/rule-sets", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        assertEquals(422, resp.getStatusCode().value());
        assertEquals(4245, extractCode(resp.getBody()));
    }

    private void createRuleSet(TestContext ctx, String name) {
        String body = """
                {"name":"%s","description":"测试","stageCode":"SD","rules":[]}
                """.formatted(name);
        restTemplate.exchange(
                "/api/v1/rule-sets", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);
    }

    private record TestContext(UUID tenantId, String accessToken) {}
}
