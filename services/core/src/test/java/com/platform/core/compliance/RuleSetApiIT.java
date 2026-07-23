package com.platform.core.compliance;

import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RuleSetApiIT extends AbstractIntegrationTest {

    private UUID testTenantId;
    private String accessToken;

    @Test
    @Order(1)
    @DisplayName("应该能创建规则集")
    void shouldCreateRuleSet() throws Exception {
        testTenantId = createTestTenant("rule-set-test");
        UUID principalId = createTestPrincipal(testTenantId, "rule-set@test.com");
        accessToken = loginAndGetAccessToken(testTenantId, "rule-set@test.com");

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
                new HttpEntity<>(body, withAccessToken(testTenantId, accessToken)), String.class);

        assertEquals(201, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
        assertTrue(extractData(resp.getBody()).has("id"));
        assertEquals("方案设计合规检查规则集", extractData(resp.getBody()).get("name").asText());
        assertEquals("SD", extractData(resp.getBody()).get("stageCode").asText());
        assertEquals("DRAFT", extractData(resp.getBody()).get("status").asText());
    }

    @Test
    @Order(2)
    @DisplayName("应该能查询规则集列表")
    void shouldListRuleSets() throws Exception {
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/rule-sets?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(testTenantId, accessToken)), String.class);

        assertEquals(200, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
        assertTrue(extractData(resp.getBody()).has("list"));
    }

    @Test
    @Order(3)
    @DisplayName("应该能按阶段筛选规则集")
    void shouldFilterRuleSetsByStage() throws Exception {
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/rule-sets?stageCode=SD", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(testTenantId, accessToken)), String.class);

        assertEquals(200, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
    }

    @Test
    @Order(4)
    @DisplayName("应该拒绝重复的规则集名称")
    void shouldRejectDuplicateRuleSetName() throws Exception {
        String body = """
                {
                    "name": "方案设计合规检查规则集",
                    "description": "重复名称",
                    "stageCode": "SD"
                }
                """;

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/rule-sets", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(testTenantId, accessToken)), String.class);

        assertEquals(422, resp.getStatusCode().value());
        assertEquals(4245, extractCode(resp.getBody()));
    }
}