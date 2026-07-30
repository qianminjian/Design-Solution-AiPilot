package com.platform.core.compliance;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 合规规则 API 集成测试
 *
 * <p>每个测试方法独立创建租户、主体与规则，避免 @Order 依赖被 @BeforeEach truncate 清空数据。
 */
@DisplayName("合规规则（ComplianceRule）API 集成测试")
class ComplianceRuleApiIT extends AbstractIntegrationTest {

    private static final String RULES_URL = "/api/v1/compliance-rules";

    /**
     * 应该能创建合规规则
     */
    @Test
    @DisplayName("应该能创建合规规则（201 + CANDIDATE 状态）")
    void shouldCreateComplianceRule() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {
                    "ruleCode": "CODE_MIN_5_FLOORS",
                    "name": "办公楼最小层数要求",
                    "category": "CODE_CHECK",
                    "description": "办公楼项目最小层数应不低于5层（OD-02）",
                    "basis": {"standard": "ISO", "reference": "OD-02"}
                }
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                RULES_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.has("id"), "应返回规则 ID"),
                () -> assertEquals("CODE_MIN_5_FLOORS", data.path("ruleCode").asText()),
                () -> assertEquals("CANDIDATE", data.path("status").asText())
        );
    }

    /**
     * 应该能查询合规规则列表
     */
    @Test
    @DisplayName("应该能查询合规规则列表（200 + list 非空）")
    void shouldListComplianceRules() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        createRule(ctx, "LIST_RULE_001");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                RULES_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.has("list"), "响应应包含 list 字段"),
                () -> assertTrue(data.path("list").size() >= 1, "应至少有 1 条规则")
        );
    }

    /**
     * 应该能创建规则版本
     */
    @Test
    @DisplayName("应该能创建规则版本（201 + revisionNo=1 + DRAFT 状态）")
    void shouldCreateRuleRevision() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String ruleId = createRule(ctx, "REVISION_RULE_001");

        // 文本块中 \\" 解析为 JSON 字符串内的 \"，确保 dslJson 字段值是合法 JSON 字符串
        // 注意：V16 迁移将 basis 列从 JSONB 改为 TEXT，CreateRuleRevisionRequest.basis 是 String 类型
        String body = """
                {
                    "dslJson": "{\\"ruleType\\":\\"RANGE_CHECK\\",\\"propertyName\\":\\"floors\\",\\"minValue\\":5,\\"maxValue\\":15}",
                    "parametersJson": {"unit": "floors"},
                    "basis": "ISO 19650 / OD-02",
                    "engineProfile": "DEFAULT"
                }
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                RULES_URL + "/" + ruleId + "/revisions", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.has("id"), "应返回版本 ID"),
                () -> assertEquals(1, data.path("revisionNo").asInt()),
                () -> assertEquals("DRAFT", data.path("status").asText())
        );
    }

    /**
     * 应该拒绝重复的规则编码
     */
    @Test
    @DisplayName("应该拒绝重复的规则编码（422 + 业务码 4242）")
    void shouldRejectDuplicateRuleCode() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        createRule(ctx, "DUP_RULE_001");

        String body = """
                {
                    "ruleCode": "DUP_RULE_001",
                    "name": "重复规则",
                    "category": "CODE_CHECK"
                }
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                RULES_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4242, extractCode(resp.getBody()))
        );
    }

    // ── 内部辅助方法 ──

    /**
     * 创建独立测试上下文（租户 + 主体 + access token）
     */
    private TestContext createContext() {
        UUID tenantId = createTestTenant("compliance-rule-" + UUID.randomUUID());
        String email = "compliance-rule+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String token = loginAndGetAccessToken(tenantId, email);
        return new TestContext(tenantId, token);
    }

    /**
     * 创建合规规则并返回规则 ID
     */
    private String createRule(TestContext ctx, String ruleCode) throws Exception {
        String body = """
                {
                    "ruleCode": "%s",
                    "name": "测试规则-%s",
                    "category": "CODE_CHECK",
                    "description": "测试用规则",
                    "basis": {"standard": "ISO"}
                }
                """.formatted(ruleCode, ruleCode);

        ResponseEntity<String> resp = restTemplate.exchange(
                RULES_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建规则失败: " + resp.getBody());
        assertNotNull(resp.getBody());
        return extractData(resp.getBody()).path("id").asText();
    }

    private record TestContext(UUID tenantId, String accessToken) {}
}
