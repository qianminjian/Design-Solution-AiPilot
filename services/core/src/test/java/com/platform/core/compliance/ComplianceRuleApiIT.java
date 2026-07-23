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

class ComplianceRuleApiIT extends AbstractIntegrationTest {

    private UUID testTenantId;
    private String accessToken;

    @Test
    @Order(1)
    @DisplayName("应该能创建合规规则")
    void shouldCreateComplianceRule() throws Exception {
        testTenantId = createTestTenant("compliance-rule-test");
        UUID principalId = createTestPrincipal(testTenantId, "compliance-rule@test.com");
        accessToken = loginAndGetAccessToken(testTenantId, "compliance-rule@test.com");

        String body = """
                {
                    "ruleCode": "CODE_MIN_5_FLOORS",
                    "name": "办公楼最小层数要求",
                    "category": "CODE_CHECK",
                    "description": "办公楼项目最小层数应不低于5层（OD-02）",
                    "basis": {"standard": "ISO", "reference": "OD-02"}
                }
                """;

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/compliance-rules", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(testTenantId, accessToken)), String.class);

        assertEquals(201, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
        assertTrue(extractData(resp.getBody()).has("id"));
        assertEquals("CODE_MIN_5_FLOORS", extractData(resp.getBody()).get("ruleCode").asText());
        assertEquals("CANDIDATE", extractData(resp.getBody()).get("status").asText());
    }

    @Test
    @Order(2)
    @DisplayName("应该能查询合规规则列表")
    void shouldListComplianceRules() throws Exception {
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/compliance-rules?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(testTenantId, accessToken)), String.class);

        assertEquals(200, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
        assertTrue(extractData(resp.getBody()).has("list"));
    }

    @Test
    @Order(3)
    @DisplayName("应该能创建规则版本")
    void shouldCreateRuleRevision() throws Exception {
        ResponseEntity<String> listResp = restTemplate.exchange(
                "/api/v1/compliance-rules?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(testTenantId, accessToken)), String.class);

        String ruleId = extractData(listResp.getBody()).get("list").get(0).get("id").asText();

        String body = """
                {
                    "dslJson": "{\"ruleType\":\"RANGE_CHECK\",\"propertyName\":\"floors\",\"minValue\":5,\"maxValue\":15}",
                    "parametersJson": {"unit": "floors"},
                    "basis": {"source": "OD-02"},
                    "engineProfile": "DEFAULT"
                }
                """;

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/compliance-rules/" + ruleId + "/revisions", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(testTenantId, accessToken)), String.class);

        assertEquals(201, resp.getStatusCode().value());
        assertNotNull(resp.getBody());
        assertEquals(0, extractCode(resp.getBody()));
        assertTrue(extractData(resp.getBody()).has("id"));
        assertEquals(1, extractData(resp.getBody()).get("revisionNo").asInt());
        assertEquals("DRAFT", extractData(resp.getBody()).get("status").asText());
    }

    @Test
    @Order(4)
    @DisplayName("应该拒绝重复的规则编码")
    void shouldRejectDuplicateRuleCode() throws Exception {
        String body = """
                {
                    "ruleCode": "CODE_MIN_5_FLOORS",
                    "name": "重复规则",
                    "category": "CODE_CHECK"
                }
                """;

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/compliance-rules", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(testTenantId, accessToken)), String.class);

        assertEquals(422, resp.getStatusCode().value());
        assertEquals(4242, extractCode(resp.getBody()));
    }
}