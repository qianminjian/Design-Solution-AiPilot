package com.platform.core.iam;

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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 主体（Principal）API 集成测试
 *
 * <p>覆盖 POST / GET / PATCH 端点与业务规则校验：
 * <ul>
 *   <li>POST /api/v1/principals 为公开端点（注册），不需要认证</li>
 *   <li>GET / PATCH 需要 access token</li>
 *   <li>同租户邮箱唯一</li>
 * </ul>
 */
@DisplayName("主体（Principal）API 集成测试")
class PrincipalApiIT extends AbstractIntegrationTest {

    /** 主体列表端点 */
    private static final String PRINCIPALS_URL = "/api/v1/principals";

    /**
     * 应该成功创建主体
     *
     * <p>POST /api/v1/principals 为公开端点，请求体含 email/displayName/password，
     * 返回 201 + PrincipalDto（不暴露 passwordHash）。
     */
    @Test
    @DisplayName("应该成功创建主体并返回 201")
    void shouldCreatePrincipalSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-create-" + UUID.randomUUID());
        String email = "alice+" + UUID.randomUUID() + "@example.com";
        String body = """
                {"email":"%s","displayName":"Alice","password":"Test1234"}
                """.formatted(email);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PRINCIPALS_URL, HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders(tenantId)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode(),
                        "创建主体应返回 201"),
                () -> assertEquals(0, extractCode(resp.getBody()), "业务码应为 0"),
                () -> assertEquals(email, data.path("email").asText(), "邮箱应一致"),
                () -> assertEquals("Alice", data.path("displayName").asText(), "显示名应一致"),
                () -> assertEquals("USER", data.path("type").asText(), "默认类型应为 USER"),
                () -> assertEquals("ACTIVE", data.path("status").asText(), "默认状态应为 ACTIVE"),
                () -> assertNotNull(data.path("id").asText(), "应返回主体 ID"),
                () -> assertNull(data.path("passwordHash").textValue(),
                        "响应体不应包含 passwordHash")
        );
    }

    /**
     * 应该拒绝同租户重复邮箱
     *
     * <p>同租户 + 同邮箱重复创建返回 422 + PRINCIPAL_ALREADY_EXISTS。
     */
    @Test
    @DisplayName("应该拒绝同租户下重复邮箱（422）")
    void shouldRejectDuplicateEmail() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-dup-" + UUID.randomUUID());
        String email = "bob+" + UUID.randomUUID() + "@example.com";
        String body = """
                {"email":"%s","displayName":"Bob","password":"Test1234"}
                """.formatted(email);

        // 第一次创建成功
        restTemplate.exchange(PRINCIPALS_URL, HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders(tenantId)), String.class);

        // Act（执行）：第二次创建应失败
        ResponseEntity<String> resp = restTemplate.exchange(
                PRINCIPALS_URL, HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders(tenantId)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode(),
                        "重复邮箱应返回 422"),
                () -> assertEquals(4221, extractCode(resp.getBody()),
                        "业务码应为 PRINCIPAL_ALREADY_EXISTS（4221）"),
                () -> assertTrue(extractMessage(resp.getBody()).contains(email),
                        "错误消息应包含冲突的邮箱")
        );
    }

    /**
     * 应该按 ID 查询主体
     */
    @Test
    @DisplayName("应该按 ID 查询主体")
    void shouldGetPrincipalById() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-get-" + UUID.randomUUID());
        String email = "carol+" + UUID.randomUUID() + "@example.com";
        String createBody = """
                {"email":"%s","displayName":"Carol","password":"Test1234"}
                """.formatted(email);
        ResponseEntity<String> createResp = restTemplate.exchange(
                PRINCIPALS_URL, HttpMethod.POST,
                new HttpEntity<>(createBody, jsonHeaders(tenantId)), String.class);
        UUID principalId = UUID.fromString(extractData(createResp.getBody()).path("id").asText());

        // 创建后登录获取 access token（POST 公开，但 GET 需认证）
        String accessToken = loginAndGetAccessToken(tenantId, email);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PRINCIPALS_URL + "/" + principalId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(principalId.toString(), data.path("id").asText()),
                () -> assertEquals(email, data.path("email").asText()),
                () -> assertEquals("Carol", data.path("displayName").asText())
        );
    }

    /**
     * 应该分页查询主体
     */
    @Test
    @DisplayName("应该分页查询主体列表")
    void shouldListPrincipalsWithPagination() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-list-" + UUID.randomUUID());
        String seedEmail = "dave+" + UUID.randomUUID() + "@example.com";
        // 创建一个主体（用于登录）
        String createBody = """
                {"email":"%s","displayName":"Dave","password":"Test1234"}
                """.formatted(seedEmail);
        restTemplate.exchange(PRINCIPALS_URL, HttpMethod.POST,
                new HttpEntity<>(createBody, jsonHeaders(tenantId)), String.class);
        String accessToken = loginAndGetAccessToken(tenantId, seedEmail);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PRINCIPALS_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("page").asInt(), "当前页应为 1"),
                () -> assertEquals(10, data.path("pageSize").asInt(), "每页应为 10"),
                () -> assertTrue(data.path("total").asLong() >= 1, "总数应 ≥ 1"),
                () -> assertTrue(data.path("list").isArray(), "list 应为数组"),
                () -> assertTrue(data.path("list").size() >= 1, "列表至少 1 条记录")
        );
    }

    /**
     * 应该更新主体显示名
     */
    @Test
    @DisplayName("应该更新主体显示名（PATCH）")
    void shouldUpdatePrincipalDisplayName() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-update-" + UUID.randomUUID());
        String email = "eve+" + UUID.randomUUID() + "@example.com";
        String createBody = """
                {"email":"%s","displayName":"Eve","password":"Test1234"}
                """.formatted(email);
        ResponseEntity<String> createResp = restTemplate.exchange(
                PRINCIPALS_URL, HttpMethod.POST,
                new HttpEntity<>(createBody, jsonHeaders(tenantId)), String.class);
        UUID principalId = UUID.fromString(extractData(createResp.getBody()).path("id").asText());
        String accessToken = loginAndGetAccessToken(tenantId, email);

        String updateBody = """
                {"displayName":"Eve Updated"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PRINCIPALS_URL + "/" + principalId, HttpMethod.PATCH,
                new HttpEntity<>(updateBody, withAccessToken(tenantId, accessToken)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("Eve Updated", data.path("displayName").asText()),
                () -> assertEquals(email, data.path("email").asText(), "邮箱不应被修改"),
                () -> assertNotEquals("Eve", data.path("displayName").asText(),
                        "显示名应已更新")
        );
    }

    /**
     * 应该拒绝无效邮箱格式
     *
     * <p>@Email 校验失败返回 400 + PARAM_INVALID。
     */
    @Test
    @DisplayName("应该拒绝无效邮箱格式（400）")
    void shouldRejectInvalidEmail() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-invalid-" + UUID.randomUUID());
        String body = """
                {"email":"not-an-email","displayName":"Invalid","password":"Test1234"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PRINCIPALS_URL, HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders(tenantId)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode(),
                        "无效邮箱应返回 400"),
                () -> assertEquals(102, extractCode(resp.getBody()),
                        "业务码应为 PARAM_INVALID（102）"),
                () -> assertTrue(extractMessage(resp.getBody()).contains("email"),
                        "错误消息应指出 email 字段")
        );
    }
}
