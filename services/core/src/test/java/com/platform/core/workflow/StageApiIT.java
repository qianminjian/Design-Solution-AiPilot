package com.platform.core.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.iam.domain.DataClassification;
import com.platform.core.testsupport.AbstractIntegrationTest;
import com.platform.core.workflow.domain.WorkflowStageInstance;
import com.platform.core.workflow.repository.WorkflowStageInstanceRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
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
 * 工作流阶段实例（WorkflowStageInstance）API 集成测试
 *
 * <p>覆盖 workflow 域阶段端点：
 * <ul>
 *   <li>GET  /api/v1/projects/{projectId}/stages - 列出项目阶段</li>
 *   <li>POST /api/v1/stages/{stageId}/transition - 阶段状态流转</li>
 * </ul>
 *
 * <p>状态机校验遵循 D05.4.1（NOT_STARTED → ACTIVE 合法，NOT_STARTED → APPROVED 非法）。
 * 测试数据通过 workflow Repository 直接创建（workflow 域暂无创建阶段 API）。
 */
@DisplayName("工作流阶段实例（WorkflowStageInstance）API 集成测试")
class StageApiIT extends AbstractIntegrationTest {

    /** 项目端点（用于创建测试项目） */
    private static final String PROJECTS_URL = "/api/v1/projects";

    @Autowired
    private WorkflowStageInstanceRepository stageInstanceRepository;

    /**
     * 应该按项目 ID 列出所有阶段（按 stage_order 升序）
     */
    @Test
    @DisplayName("应该按项目 ID 列出工作流阶段（按 stage_order 升序）")
    void shouldListStagesByProject() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("wf-stage-list-" + UUID.randomUUID());
        String email = "wf-sl+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-SL-" + UUID.randomUUID());
        // 通过 Repository 创建测试阶段数据
        createStage(tenantId, projectId, "STG-P0", "前期策划与需求门", 0, "NOT_STARTED");
        createStage(tenantId, projectId, "STG-P1", "概念设计门", 1, "NOT_STARTED");
        createStage(tenantId, projectId, "STG-P2", "方案设计门", 2, "NOT_STARTED");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/projects/" + projectId + "/stages", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray(), "阶段列表应为数组"),
                () -> assertEquals(3, data.size(), "应返回 3 个阶段"),
                () -> assertEquals(0, data.get(0).path("stageOrder").asInt(),
                        "首个阶段 order 应为 0"),
                () -> assertEquals(2, data.get(2).path("stageOrder").asInt(),
                        "末个阶段 order 应为 2"),
                () -> assertEquals("STG-P0", data.get(0).path("stageCode").asText(),
                        "首个阶段应为 STG-P0"),
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
    @DisplayName("应该将工作流阶段从 NOT_STARTED 流转到 ACTIVE")
    void shouldTransitionStage() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("wf-stage-trans-" + UUID.randomUUID());
        String email = "wf-st+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-ST-" + UUID.randomUUID());
        UUID stageId = createStage(tenantId, projectId, "STG-P0", "前期策划与需求门", 0, "NOT_STARTED");

        String transitionBody = """
                {"targetStatus":"ACTIVE","comment":"启动 P0 阶段"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/stages/" + stageId + "/transition",
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
    @DisplayName("应该拒绝非法状态流转（422 + INVALID_STAGE_TRANSITION）")
    void shouldRejectInvalidTransition() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("wf-stage-inv-" + UUID.randomUUID());
        String email = "wf-si+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-SI-" + UUID.randomUUID());
        UUID stageId = createStage(tenantId, projectId, "STG-P0", "前期策划与需求门", 0, "NOT_STARTED");

        String transitionBody = """
                {"targetStatus":"APPROVED","comment":"非法跳转"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/stages/" + stageId + "/transition",
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

    /**
     * 应该按 status 过滤阶段列表
     */
    @Test
    @DisplayName("应该按 status 过滤工作流阶段列表")
    void shouldFilterStagesByStatus() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("wf-stage-filter-" + UUID.randomUUID());
        String email = "wf-sf+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-SF-" + UUID.randomUUID());
        createStage(tenantId, projectId, "STG-P0", "前期策划与需求门", 0, "ACTIVE");
        createStage(tenantId, projectId, "STG-P1", "概念设计门", 1, "NOT_STARTED");
        createStage(tenantId, projectId, "STG-P2", "方案设计门", 2, "NOT_STARTED");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/projects/" + projectId + "/stages?status=ACTIVE", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray(), "阶段列表应为数组"),
                () -> assertEquals(1, data.size(), "应仅返回 ACTIVE 状态阶段"),
                () -> assertEquals("ACTIVE", data.get(0).path("status").asText(),
                        "过滤后状态应为 ACTIVE")
        );
    }

    // ── 内部辅助方法 ──

    /**
     * 通过 portfolio API 创建项目并返回项目 ID
     */
    private UUID createProject(UUID tenantId, String accessToken, String projectCode) throws Exception {
        String body = """
                {"name":"工作流阶段测试项目","code":"%s"}
                """.formatted(projectCode);
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建项目失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

    /**
     * 通过 Repository 直接创建工作流阶段实例
     */
    private UUID createStage(UUID tenantId, UUID projectId, String stageCode,
                             String stageName, int stageOrder, String status) {
        WorkflowStageInstance stage = new WorkflowStageInstance();
        stage.setTenantId(tenantId);
        stage.setProjectId(projectId);
        stage.setStageCode(stageCode);
        stage.setStageName(stageName);
        stage.setStageOrder(stageOrder);
        stage.setStatus(status);
        stage.setClassification(DataClassification.PROJECT_RECORD);
        stage.setMetadata("{}");
        WorkflowStageInstance saved = stageInstanceRepository.save(stage);
        return saved.getId();
    }
}
