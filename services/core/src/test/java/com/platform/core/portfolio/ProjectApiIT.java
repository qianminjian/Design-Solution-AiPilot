package com.platform.core.portfolio;

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
 * 项目（Project）API 集成测试
 *
 * <p>覆盖项目 CRUD、租户内 code 唯一约束、创建项目时默认阶段实例化等业务规则。
 * 所有端点均需 access token（POST /api/v1/projects 不在公开路径）。
 */
@DisplayName("项目（Project）API 集成测试")
class ProjectApiIT extends AbstractIntegrationTest {

    /** 项目端点 */
    private static final String PROJECTS_URL = "/api/v1/projects";

    /**
     * 应该成功创建项目
     *
     * <p>POST /api/v1/projects 需认证，返回 201 + ProjectDto。
     */
    @Test
    @DisplayName("应该成功创建项目并返回 201")
    void shouldCreateProjectSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("proj-tenant-" + UUID.randomUUID());
        String email = "pm+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        String projectCode = "PRJ-" + UUID.randomUUID().toString().substring(0, 8);
        String body = """
                {"name":"测试办公塔","code":"%s","description":"V0 试点项目","buildingType":"OFFICE","floorsMin":5,"floorsMax":12}
                """.formatted(projectCode);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(projectCode, data.path("code").asText()),
                () -> assertEquals("测试办公塔", data.path("name").asText()),
                () -> assertEquals("OFFICE", data.path("buildingType").asText()),
                () -> assertEquals(5, data.path("floorsMin").asInt()),
                () -> assertEquals(12, data.path("floorsMax").asInt()),
                () -> assertEquals("ACTIVE", data.path("status").asText()),
                () -> assertNotNull(data.path("id").asText())
        );
    }

    /**
     * 应该拒绝同租户重复 code
     *
     * <p>同租户 + 同 code 重复创建返回 422 + PROJECT_CODE_ALREADY_EXISTS。
     */
    @Test
    @DisplayName("应该拒绝同租户下重复 code（422）")
    void shouldRejectDuplicateCode() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("dup-tenant-" + UUID.randomUUID());
        String email = "pm-dup+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        String projectCode = "DUP-" + UUID.randomUUID().toString().substring(0, 8);
        String body = """
                {"name":"项目一","code":"%s"}
                """.formatted(projectCode);
        // 第一次创建成功
        restTemplate.exchange(PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);

        // Act（执行）：第二次创建同 code 应失败
        String dupBody = """
                {"name":"项目二","code":"%s"}
                """.formatted(projectCode);
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(dupBody, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4228, extractCode(resp.getBody()),
                        "业务码应为 PROJECT_CODE_ALREADY_EXISTS（4228）"),
                () -> assertTrue(extractMessage(resp.getBody()).contains(projectCode),
                        "错误消息应包含冲突的 code")
        );
    }

    /**
     * 应该按 ID 查询项目
     */
    @Test
    @DisplayName("应该按 ID 查询项目")
    void shouldGetProjectById() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("get-tenant-" + UUID.randomUUID());
        String email = "pm-get+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        String projectCode = "GET-" + UUID.randomUUID().toString().substring(0, 8);
        String createBody = """
                {"name":"查询测试","code":"%s"}
                """.formatted(projectCode);
        ResponseEntity<String> createResp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(createBody, withAccessToken(tenantId, accessToken)), String.class);
        UUID projectId = UUID.fromString(extractData(createResp.getBody()).path("id").asText());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(projectId.toString(), data.path("id").asText()),
                () -> assertEquals(projectCode, data.path("code").asText()),
                () -> assertEquals("查询测试", data.path("name").asText())
        );
    }

    /**
     * 应该分页查询项目
     */
    @Test
    @DisplayName("应该分页查询项目列表")
    void shouldListProjects() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("list-tenant-" + UUID.randomUUID());
        String email = "pm-list+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        String projectCode = "LST-" + UUID.randomUUID().toString().substring(0, 8);
        String createBody = """
                {"name":"列表测试","code":"%s"}
                """.formatted(projectCode);
        restTemplate.exchange(PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(createBody, withAccessToken(tenantId, accessToken)), String.class);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("page").asInt()),
                () -> assertEquals(10, data.path("pageSize").asInt()),
                () -> assertTrue(data.path("total").asLong() >= 1),
                () -> assertTrue(data.path("list").isArray()),
                () -> assertTrue(data.path("list").size() >= 1)
        );
    }

    /**
     * 应该更新项目
     */
    @Test
    @DisplayName("应该更新项目名称（PATCH）")
    void shouldUpdateProject() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("upd-tenant-" + UUID.randomUUID());
        String email = "pm-upd+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        String projectCode = "UPD-" + UUID.randomUUID().toString().substring(0, 8);
        String createBody = """
                {"name":"原名","code":"%s"}
                """.formatted(projectCode);
        ResponseEntity<String> createResp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(createBody, withAccessToken(tenantId, accessToken)), String.class);
        UUID projectId = UUID.fromString(extractData(createResp.getBody()).path("id").asText());

        String updateBody = """
                {"name":"新名称","description":"更新后描述"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId, HttpMethod.PATCH,
                new HttpEntity<>(updateBody, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("新名称", data.path("name").asText()),
                () -> assertEquals("更新后描述", data.path("description").asText()),
                () -> assertEquals(projectCode, data.path("code").asText(),
                        "code 不应被修改")
        );
    }

    /**
     * 应该在创建项目时自动创建默认阶段
     *
     * <p>ProjectService.createProject 在 stages 为空时使用 V0 裁剪集（P0/P1/P2/P5/P6/P7），
     * 创建项目后通过 GET /api/v1/projects/{id}/stages 验证阶段数量为 6。
     */
    @Test
    @DisplayName("应该在创建项目时自动创建 V0 默认阶段（6 个）")
    void shouldCreateDefaultStagesOnProjectCreate() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("stage-tenant-" + UUID.randomUUID());
        String email = "pm-stage+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        String projectCode = "STG-" + UUID.randomUUID().toString().substring(0, 8);
        String createBody = """
                {"name":"阶段测试项目","code":"%s"}
                """.formatted(projectCode);
        ResponseEntity<String> createResp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(createBody, withAccessToken(tenantId, accessToken)), String.class);
        UUID projectId = UUID.fromString(extractData(createResp.getBody()).path("id").asText());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId + "/stages", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray(), "阶段列表应为数组"),
                () -> assertEquals(6, data.size(), "V0 默认阶段应为 6 个（P0/P1/P2/P5/P6/P7）"),
                () -> assertEquals("NOT_STARTED", data.get(0).path("status").asText(),
                        "新建阶段状态应为 NOT_STARTED"),
                () -> assertEquals("STG-P0", data.get(0).path("stageCode").asText(),
                        "首个阶段应为 STG-P0"),
                () -> assertEquals("STG-P7", data.get(5).path("stageCode").asText(),
                        "末个阶段应为 STG-P7")
        );
    }
}
