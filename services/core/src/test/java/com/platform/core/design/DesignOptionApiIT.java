package com.platform.core.design;

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
 * 设计选项（DesignOption）API 集成测试
 *
 * <p>覆盖设计选项与反馈的 CRUD 端点：
 * <ul>
 *   <li>POST /api/v1/design-options 创建设计选项（需 X-User-Id header）</li>
 *   <li>GET /api/v1/design-options 分页查询</li>
 *   <li>GET /api/v1/design-options/{id} 查询详情</li>
 *   <li>POST /api/v1/design-options/{id}/feedback 提交反馈</li>
 *   <li>GET /api/v1/design-options/{id}/feedback 反馈列表</li>
 * </ul>
 */
@DisplayName("设计选项（DesignOption）API 集成测试")
class DesignOptionApiIT extends AbstractIntegrationTest {

    private static final String DESIGN_OPTIONS_URL = "/api/v1/design-options";
    private static final String PROJECTS_URL = "/api/v1/projects";
    private static final String USER_ID_HEADER = "X-User-Id";

    /**
     * 应该成功创建设计选项
     *
     * <p>POST 端点需要 X-Tenant-Id / X-User-Id header + Bearer token。
     * 默认状态为 DRAFT，默认专业为 ARCHITECTURE。
     */
    @Test
    @DisplayName("应该成功创建设计选项并返回 201")
    void shouldCreateDesignOptionSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-do-create-" + UUID.randomUUID());
        String email = "do-create+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken, "DO-CREATE-" + UUID.randomUUID());

        String body = """
                {"projectId":"%s","title":"方案 A","description":"初始方案","metadata":"{}"}
                """.formatted(projectId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                DESIGN_OPTIONS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode(),
                        "创建应返回 201"),
                () -> assertEquals(0, extractCode(resp.getBody()), "业务码应为 0"),
                () -> assertNotNull(data.path("id").asText(), "应返回 ID"),
                () -> assertEquals(projectId.toString(), data.path("projectId").asText()),
                () -> assertEquals("方案 A", data.path("title").asText()),
                () -> assertEquals("初始方案", data.path("description").asText()),
                () -> assertEquals("DRAFT", data.path("status").asText(),
                        "默认状态应为 DRAFT"),
                () -> assertEquals("ARCHITECTURE", data.path("discipline").asText(),
                        "默认专业应为 ARCHITECTURE"),
                () -> assertEquals(userId.toString(), data.path("createdBy").asText())
        );
    }

    /**
     * 应该按项目分页查询设计选项
     */
    @Test
    @DisplayName("应该按项目分页查询设计选项")
    void shouldListDesignOptionsByProject() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-do-list-" + UUID.randomUUID());
        String email = "do-list+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken, "DO-LIST-" + UUID.randomUUID());

        createDesignOption(tenantId, accessToken, userId, projectId, "方案一");
        createDesignOption(tenantId, accessToken, userId, projectId, "方案二");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                DESIGN_OPTIONS_URL + "?projectId=" + projectId + "&page=1&pageSize=10",
                HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(1, data.path("page").asInt()),
                () -> assertEquals(10, data.path("pageSize").asInt()),
                () -> assertTrue(data.path("total").asLong() >= 2, "总数应 ≥ 2"),
                () -> assertTrue(data.path("list").isArray()),
                () -> assertTrue(data.path("list").size() >= 2)
        );
    }

    /**
     * 应该查询设计选项详情
     */
    @Test
    @DisplayName("应该查询设计选项详情")
    void shouldGetDesignOptionById() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-do-get-" + UUID.randomUUID());
        String email = "do-get+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken, "DO-GET-" + UUID.randomUUID());
        UUID optionId = createDesignOption(tenantId, accessToken, userId, projectId, "详情测试");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                DESIGN_OPTIONS_URL + "/" + optionId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(optionId.toString(), data.path("id").asText()),
                () -> assertEquals("详情测试", data.path("title").asText()),
                () -> assertEquals(projectId.toString(), data.path("projectId").asText())
        );
    }

    /**
     * 应该拒绝查询不存在的设计选项（404）
     */
    @Test
    @DisplayName("应该拒绝查询不存在的设计选项（404）")
    void shouldRejectGetNonExistentOption() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-do-404-" + UUID.randomUUID());
        String email = "do-404+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID randomOptionId = UUID.randomUUID();

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                DESIGN_OPTIONS_URL + "/" + randomOptionId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode()),
                () -> assertTrue(extractCode(resp.getBody()) != 0, "业务码应非 0")
        );
    }

    /**
     * 应该成功提交设计反馈
     */
    @Test
    @DisplayName("应该成功提交设计反馈并返回 201")
    void shouldSubmitFeedbackSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-do-fb-" + UUID.randomUUID());
        String email = "do-fb+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken, "DO-FB-" + UUID.randomUUID());
        UUID optionId = createDesignOption(tenantId, accessToken, userId, projectId, "反馈测试");

        String body = """
                {"comment":"方案合理","rating":5}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                DESIGN_OPTIONS_URL + "/" + optionId + "/feedback", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertNotNull(data.path("id").asText()),
                () -> assertEquals(optionId.toString(), data.path("optionId").asText()),
                () -> assertEquals("方案合理", data.path("comment").asText()),
                () -> assertEquals(5, data.path("rating").asInt())
        );
    }

    /**
     * 应该查询设计选项的反馈列表
     */
    @Test
    @DisplayName("应该查询设计选项的反馈列表")
    void shouldListFeedbackByOption() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("tenant-do-fbl-" + UUID.randomUUID());
        String email = "do-fbl+" + UUID.randomUUID() + "@example.com";
        UUID userId = createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken, "DO-FBL-" + UUID.randomUUID());
        UUID optionId = createDesignOption(tenantId, accessToken, userId, projectId, "反馈列表测试");

        submitFeedback(tenantId, accessToken, userId, optionId, "第一条反馈", 4);
        submitFeedback(tenantId, accessToken, userId, optionId, "第二条反馈", 5);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                DESIGN_OPTIONS_URL + "/" + optionId + "/feedback", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.isArray()),
                () -> assertTrue(data.size() >= 2, "反馈列表至少 2 条")
        );
    }

    // ── 辅助方法 ──

    /**
     * 构造带 X-Tenant-Id / X-User-Id / Authorization 的请求头
     */
    private HttpHeaders withUserHeaders(UUID tenantId, String accessToken, UUID userId) {
        HttpHeaders headers = withAccessToken(tenantId, accessToken);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(USER_ID_HEADER, userId.toString());
        return headers;
    }

    /**
     * 创建项目（用于关联设计选项）
     */
    private UUID createProject(UUID tenantId, String accessToken, String projectCode) throws Exception {
        String body = """
                {"name":"设计选项测试项目","code":"%s"}
                """.formatted(projectCode);
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建项目失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

    /**
     * 创建设计选项（封装重复调用）
     */
    private UUID createDesignOption(UUID tenantId, String accessToken, UUID userId,
                                     UUID projectId, String title) throws Exception {
        String body = """
                {"projectId":"%s","title":"%s","description":"测试方案","metadata":"{}"}
                """.formatted(projectId, title);
        ResponseEntity<String> resp = restTemplate.exchange(
                DESIGN_OPTIONS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建设计选项失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

    /**
     * 提交设计反馈（封装重复调用）
     */
    private void submitFeedback(UUID tenantId, String accessToken, UUID userId,
                                 UUID optionId, String comment, int rating) throws Exception {
        String body = """
                {"comment":"%s","rating":%d}
                """.formatted(comment, rating);
        ResponseEntity<String> resp = restTemplate.exchange(
                DESIGN_OPTIONS_URL + "/" + optionId + "/feedback", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(tenantId, accessToken, userId)),
                String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "提交反馈失败: " + resp.getBody());
    }
}
