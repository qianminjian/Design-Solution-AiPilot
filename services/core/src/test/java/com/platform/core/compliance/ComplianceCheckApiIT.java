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

class ComplianceCheckApiIT extends AbstractIntegrationTest {

    private UUID testTenantId;
    private String accessToken;

    @Test
    @Order(1)
    @DisplayName("应该能创建检查运行")
    void shouldCreateCheckRun() throws Exception {
        testTenantId = createTestTenant("compliance-check-test");
        UUID principalId = createTestPrincipal(testTenantId, "compliance-check@test.com");
        accessToken = loginAndGetAccessToken(testTenantId, "compliance-check@test.com");

        UUID ruleSetId = createTestRuleSet(testTenantId);

        String body = """
                {
                    "projectId": "%s",
                    "ruleSetId": "%s"
                }
                """.formatted(UUID.randomUUID(), ruleSetId);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/compliance-checks", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(testTenantId, accessToken)), String.class);

        assertEquals(201, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
        assertTrue(extractData(resp.getBody()).has("id"));
        assertEquals("PENDING", extractData(resp.getBody()).get("status").asText());
    }

    @Test
    @Order(2)
    @DisplayName("应该能执行检查运行")
    void shouldExecuteCheckRun() throws Exception {
        ResponseEntity<String> listResp = restTemplate.exchange(
                "/api/v1/compliance-checks?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(testTenantId, accessToken)), String.class);

        assertEquals(200, listResp.getStatusCode().value());
        if (extractData(listResp.getBody()).get("list").size() > 0) {
            String runId = extractData(listResp.getBody()).get("list").get(0).get("id").asText();

            ResponseEntity<String> resp = restTemplate.exchange(
                    "/api/v1/compliance-checks/" + runId + "/execute", HttpMethod.POST,
                    new HttpEntity<>(withAccessToken(testTenantId, accessToken)), String.class);

            assertEquals(200, resp.getStatusCode().value());
            assertNotNull(resp.getBody());
            assertEquals(0, extractCode(resp.getBody()));
        }
    }

    @Test
    @Order(3)
    @DisplayName("应该能查询检查运行列表")
    void shouldListCheckRuns() throws Exception {
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/compliance-checks?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(testTenantId, accessToken)), String.class);

        assertEquals(200, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
        assertTrue(extractData(resp.getBody()).has("list"));
    }

    private UUID createTestRuleSet(UUID tenantId) throws Exception {
        String body = """
                {
                    "name": "测试检查规则集",
                    "description": "测试用规则集",
                    "stageCode": "DD",
                    "rules": []
                }
                """;

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/rule-sets", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);

        assertEquals(201, resp.getStatusCode().value());
        return UUID.fromString(extractData(resp.getBody()).get("id").asText());
    }
}