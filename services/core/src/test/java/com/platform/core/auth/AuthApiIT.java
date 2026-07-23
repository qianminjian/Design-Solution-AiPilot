package com.platform.core.auth;

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

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 认证（Auth）API 集成测试
 *
 * <p>覆盖 /api/v1/auth 端点：
 * <ul>
 *   <li>POST /login   登录（公开）</li>
 *   <li>POST /refresh 刷新 token（公开，refresh token 从 cookie 读取）</li>
 *   <li>GET  /me      获取当前用户（已认证）</li>
 * </ul>
 *
 * <p>安全约束：
 * <ul>
 *   <li>登录失败统一返回"邮箱或密码错误"（防枚举）</li>
 *   <li>refresh token 通过 httpOnly + SameSite=Strict Cookie 设置</li>
 * </ul>
 */
@DisplayName("认证（Auth）API 集成测试")
class AuthApiIT extends AbstractIntegrationTest {

    /** 登录端点（公开） */
    private static final String LOGIN_URL = "/api/v1/auth/login";
    /** 刷新端点（公开，refresh token 从 cookie 读取） */
    private static final String REFRESH_URL = "/api/v1/auth/refresh";
    /** 当前用户端点（已认证） */
    private static final String ME_URL = "/api/v1/auth/me";

    /** refresh token cookie 名 */
    private static final String REFRESH_TOKEN_COOKIE = "refresh_token";

    /**
     * 应该成功登录并返回 access token + refresh token cookie
     */
    @Test
    @DisplayName("应该成功登录并返回 access token + 设置 refresh token Cookie")
    void shouldLoginSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("auth-login-" + UUID.randomUUID());
        String email = "auth+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);

        String body = """
                {"email":"%s","password":"%s"}
                """.formatted(email, DEFAULT_TEST_PASSWORD);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                LOGIN_URL, HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders(tenantId)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        List<String> setCookies = resp.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.path("accessToken").asText().length() > 0,
                        "应返回非空 access token"),
                () -> assertTrue(data.path("accessTokenExpiresIn").asLong() > 0,
                        "应返回 token 有效期"),
                () -> assertTrue(data.path("refreshTokenSet").asBoolean(),
                        "refreshTokenSet 应为 true"),
                () -> assertEquals(email, data.path("principal").path("email").asText()),
                () -> assertEquals(tenantId.toString(),
                        data.path("principal").path("tenantId").asText()),
                () -> assertNotNull(setCookies, "应设置 Set-Cookie 头"),
                () -> assertTrue(
                        setCookies.stream().anyMatch(c -> c.startsWith(REFRESH_TOKEN_COOKIE + "=")),
                        "Set-Cookie 应包含 refresh_token"),
                () -> assertTrue(
                        setCookies.stream().anyMatch(c -> c.contains("HttpOnly")),
                        "Cookie 应标记 HttpOnly"),
                () -> assertTrue(
                        setCookies.stream().anyMatch(c -> c.contains("SameSite=Strict")),
                        "Cookie 应标记 SameSite=Strict")
        );
    }

    /**
     * 应该拒绝错误密码（401 + 防枚举统一错误）
     */
    @Test
    @DisplayName("应该拒绝错误密码（401 + 防枚举统一错误）")
    void shouldRejectWrongPassword() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("auth-wrong-" + UUID.randomUUID());
        String email = "wrong-pwd+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);

        String body = """
                {"email":"%s","password":"WrongPassword123"}
                """.formatted(email);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                LOGIN_URL, HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders(tenantId)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode()),
                () -> assertEquals(4011, extractCode(resp.getBody()),
                        "业务码应为 BAD_CREDENTIALS（4011）"),
                () -> assertTrue(extractMessage(resp.getBody()).contains("邮箱或密码错误"),
                        "错误消息应为防枚举统一文案")
        );
    }

    /**
     * 应该拒绝不存在的邮箱（401，与错误密码相同响应以防枚举）
     */
    @Test
    @DisplayName("应该拒绝不存在邮箱（401，与错误密码相同响应）")
    void shouldRejectNonExistentEmail() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("auth-missing-" + UUID.randomUUID());
        String body = """
                {"email":"nonexistent+%s@example.com","password":"Test1234"}
                """.formatted(UUID.randomUUID());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                LOGIN_URL, HttpMethod.POST,
                new HttpEntity<>(body, jsonHeaders(tenantId)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode()),
                () -> assertEquals(4011, extractCode(resp.getBody()),
                        "业务码应为 BAD_CREDENTIALS（4011）"),
                () -> assertTrue(extractMessage(resp.getBody()).contains("邮箱或密码错误"),
                        "不存在邮箱也应返回统一防枚举文案")
        );
    }

    /**
     * 应该使用 refresh token cookie 刷新 access token
     */
    @Test
    @DisplayName("应该使用 refresh token Cookie 刷新 access token")
    void shouldRefreshToken() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("auth-refresh-" + UUID.randomUUID());
        String email = "refresh+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);

        // 登录获取 refresh token cookie
        String loginBody = """
                {"email":"%s","password":"%s"}
                """.formatted(email, DEFAULT_TEST_PASSWORD);
        ResponseEntity<String> loginResp = restTemplate.exchange(
                LOGIN_URL, HttpMethod.POST,
                new HttpEntity<>(loginBody, jsonHeaders(tenantId)), String.class);
        String refreshToken = extractRefreshTokenFromCookies(loginResp);
        assertFalse(refreshToken.isBlank(), "应从登录响应 Set-Cookie 提取 refresh token");

        // 构造带 cookie 的刷新请求
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.COOKIE, REFRESH_TOKEN_COOKIE + "=" + refreshToken);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                REFRESH_URL, HttpMethod.POST,
                new HttpEntity<>(null, headers), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.path("accessToken").asText().length() > 0,
                        "应返回新 access token"),
                () -> assertTrue(data.path("accessTokenExpiresIn").asLong() > 0),
                () -> assertTrue(data.path("refreshTokenSet").asBoolean())
        );
    }

    /**
     * 应该返回当前登录用户上下文
     */
    @Test
    @DisplayName("应该返回当前登录用户上下文（GET /me）")
    void shouldGetCurrentUser() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("auth-me-" + UUID.randomUUID());
        String email = "me+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                ME_URL, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(email, data.path("principal").path("email").asText()),
                () -> assertEquals(tenantId.toString(),
                        data.path("principal").path("tenantId").asText()),
                () -> assertNotNull(data.path("tenant").path("code").asText(),
                        "应返回租户信息"),
                () -> assertNotNull(data.path("session").path("id").asText(),
                        "应返回会话信息（jti）"),
                () -> assertNotNull(data.path("session").path("expiresAt").asText(),
                        "应返回会话过期时间")
        );
    }

    /**
     * 应该拒绝无 token 访问受保护端点
     */
    @Test
    @DisplayName("应该拒绝无 token 访问 /me（401）")
    void shouldRejectRequestWithoutToken() throws Exception {
        // Arrange（准备）—— 不携带 Authorization 头

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                ME_URL, HttpMethod.GET, null, String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode()),
                () -> assertEquals(401, extractCode(resp.getBody()),
                        "业务码应为 UNAUTHORIZED（401）")
        );
    }

    // ── 内部辅助方法 ──

    /**
     * 从登录响应的 Set-Cookie 头中提取 refresh_token 值
     *
     * <p>Set-Cookie 格式：refresh_token=xxx; Path=/api/v1/auth; Max-Age=...; HttpOnly; SameSite=Strict
     */
    private String extractRefreshTokenFromCookies(ResponseEntity<String> loginResp) {
        List<String> setCookies = loginResp.getHeaders().get(HttpHeaders.SET_COOKIE);
        if (setCookies == null) {
            return "";
        }
        for (String cookie : setCookies) {
            if (cookie.startsWith(REFRESH_TOKEN_COOKIE + "=")) {
                String rest = cookie.substring((REFRESH_TOKEN_COOKIE + "=").length());
                int semicolon = rest.indexOf(';');
                return semicolon > 0 ? rest.substring(0, semicolon) : rest;
            }
        }
        return "";
    }
}
