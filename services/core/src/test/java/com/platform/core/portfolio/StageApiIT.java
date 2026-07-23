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
 * 阶段实例（StageInstance）API 集成测试
 *
 * <p>覆盖阶段列表查询与状态流转端点：
 * <ul>
 *   <li>GET  /api/v1/projects/{projectId}/stages</li>
 *   <li>POST /api/v1/projects/{projectId}/stages/{stageId}:transition</li>
 * </ul>
 *
 * <p>状态机校验遵循 D05.4.1（NOT_STARTED → ACTIVE 合法）。
 */
@DisplayName("阶段实例（StageInstance）API 集成测试")
class StageApiIT extends AbstractIntegrationTest {

    /** 项目端点 */
    private static final String PROJECTS_URL = "/api/v1/projects";

    /**
     * 应该按项目 ID 列出所有阶段（按 stage_order 升序）
     */
    @Test
    @DisplayName("应该按项目 ID 列出所有阶段（按 stage_order 升序）")
    void shouldListStagesByProject() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("stage-list-tenant-" + UUID.randomUUID());
        String email = "sm+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "STG-LIST-" + UUID.randomUUID());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId + "/stages", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray(), "阶段列表应为数组"),
                () -> assertEquals(6, data.size(), "V0 默认阶段为 6 个"),
                () -> assertEquals(0, data.get(0).path("stageOrder").asInt(),
                        "首个阶段 order 应为 0"),
                () -> assertEquals(7, data.get(5).path("stageOrder").asInt(),
                        "末个阶段 order 应为 7"),
                () -> assertEquals(projectId.toString(), data.get(0).path("projectId").asText(),
                        "阶段 projectId 应一致")
        );
    }

    /**
     * 应该流转阶段状态
     *
     * <p>NOT_STARTED → ACTIVE 为合法流转（D05.4.1），返回更新后的阶段实例，
     * startedAt 应被填充（首次进入 ACTIVE）。
     */
    @Test
    @DisplayName("应该将阶段从 NOT_STARTED 流转到 ACTIVE")
    void shouldTransitionStage() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("stage-trans-tenant-" + UUID.randomUUID());
        String email = "sm-trans+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "STG-TR-" + UUID.randomUUID());

        // 获取阶段列表，定位 STG-P0 阶段 ID
        ResponseEntity<String> listResp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId + "/stages", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);
        JsonNode stages = extractData(listResp.getBody());
        UUID stageId = UUID.fromString(stages.get(0).path("id").asText());

        String transitionBody = """
                {"targetStatus":"ACTIVE","comment":"启动 P0 阶段"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId + "/stages/" + stageId + ":transition",
                HttpMethod.POST,
                new HttpEntity<>(transitionBody, withAccessToken(tenantId, accessToken)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("ACTIVE", data.path("status").asText(),
                        "状态应已流转为 ACTIVE"),
                () -> assertNotNull(data.path("startedAt").asText(),
                        "首次进入 ACTIVE 应填充 startedAt"),
                () -> assertEquals(stageId.toString(), data.path("id").asText())
        );
    }

    /**
     * 应该拒绝非法状态流转
     *
     * <p>NOT_STARTED → APPROVED 不在 D05.4.1 状态机中，应返回 422 + INVALID_STAGE_TRANSITION。
     */
    @Test
    @DisplayName("应该拒绝非法状态流转（422）")
    void shouldRejectInvalidTransition() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("stage-invalid-tenant-" + UUID.randomUUID());
        String email = "sm-inv+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "STG-INV-" + UUID.randomUUID());

        ResponseEntity<String> listResp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId + "/stages", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);
        UUID stageId = UUID.fromString(extractData(listResp.getBody()).get(0).path("id").asText());

        String transitionBody = """
                {"targetStatus":"APPROVED","comment":"非法跳转"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId + "/stages/" + stageId + ":transition",
                HttpMethod.POST,
                new HttpEntity<>(transitionBody, withAccessToken(tenantId, accessToken)),
                String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4230, extractCode(resp.getBody()),
                        "业务码应为 INVALID_STAGE_TRANSITION（4230）")
        );
    }

    // ── 内部辅助方法 ──

    /**
     * 通过 API 创建项目并返回项目 ID
     */
    private UUID createProject(UUID tenantId, String accessToken, String projectCode) throws Exception {
        String body = """
                {"name":"阶段测试项目","code":"%s"}
                """.formatted(projectCode);
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建项目失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }
}
