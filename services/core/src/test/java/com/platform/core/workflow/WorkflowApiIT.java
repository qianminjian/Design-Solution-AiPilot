package com.platform.core.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.iam.domain.DataClassification;
import com.platform.core.testsupport.AbstractIntegrationTest;
import com.platform.core.workflow.domain.WorkflowGateDecision;
import com.platform.core.workflow.domain.WorkflowProjectBaseline;
import com.platform.core.workflow.domain.WorkflowRevisionStatus;
import com.platform.core.workflow.domain.WorkflowStageInstance;
import com.platform.core.workflow.repository.WorkflowGateDecisionRepository;
import com.platform.core.workflow.repository.WorkflowProjectBaselineRepository;
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
 * 工作流 REST API 集成测试（新路径 /api/v1/workflow/**）
 *
 * <p>覆盖 WorkflowController 端点：
 * <ul>
 *   <li>GET  /api/v1/workflow/stages?projectId=...          - 列出阶段</li>
 *   <li>POST /api/v1/workflow/stages/{stageId}:transition    - 阶段流转</li>
 *   <li>GET  /api/v1/workflow/gates?stageId=...              - 列出门控</li>
 *   <li>POST /api/v1/workflow/gates/{gateId}:decide         - 门控决策</li>
 *   <li>GET  /api/v1/workflow/baselines?projectId=...       - 列出基线</li>
 *   <li>GET  /api/v1/workflow/baselines/{baselineId}        - 基线详情</li>
 *   <li>POST /api/v1/workflow/baselines/{baselineId}:freeze - 冻结基线</li>
 * </ul>
 *
 * <p>租户隔离与状态机校验遵循 D05.4.1。
 */
@DisplayName("工作流 REST API（/api/v1/workflow/**）集成测试")
class WorkflowApiIT extends AbstractIntegrationTest {

    private static final String PROJECTS_URL = "/api/v1/projects";

    @Autowired
    private WorkflowStageInstanceRepository stageRepository;
    @Autowired
    private WorkflowGateDecisionRepository gateRepository;
    @Autowired
    private WorkflowProjectBaselineRepository baselineRepository;

    // ── 阶段实例 ──

    @Test
    @DisplayName("应该按项目 ID 列出工作流阶段")
    void shouldListStagesByProject() throws Exception {
        // Arrange
        UUID tenantId = createTestTenant("wf-api-list-" + UUID.randomUUID());
        String email = "wf-api-sl+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-API-SL-" + UUID.randomUUID());
        createStage(tenantId, projectId, "STG-P0", "前期策划", 0, "NOT_STARTED");
        createStage(tenantId, projectId, "STG-P1", "概念设计", 1, "ACTIVE");

        // Act
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/workflow/stages?projectId=" + projectId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray(), "阶段列表应为数组"),
                () -> assertEquals(2, data.size()),
                () -> assertEquals(0, data.get(0).path("stageOrder").asInt())
        );
    }

    @Test
    @DisplayName("应该流转工作流阶段状态（NOT_STARTED → ACTIVE）")
    void shouldTransitionStage() throws Exception {
        // Arrange
        UUID tenantId = createTestTenant("wf-api-trans-" + UUID.randomUUID());
        String email = "wf-api-st+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-API-ST-" + UUID.randomUUID());
        UUID stageId = createStage(tenantId, projectId, "STG-P0", "前期策划", 0, "NOT_STARTED");

        String body = """
                {"targetStatus":"ACTIVE","comment":"启动 P0"}
                """;

        // Act
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/workflow/stages/" + stageId + ":transition", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);

        // Assert
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("ACTIVE", data.path("status").asText()),
                () -> assertNotNull(data.path("startedAt").asText(), "首次进入 ACTIVE 应填充 startedAt")
        );
    }

    @Test
    @DisplayName("应该拒绝非法阶段流转（422 + INVALID_STAGE_TRANSITION）")
    void shouldRejectInvalidTransition() throws Exception {
        // Arrange
        UUID tenantId = createTestTenant("wf-api-inv-" + UUID.randomUUID());
        String email = "wf-api-si+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-API-SI-" + UUID.randomUUID());
        UUID stageId = createStage(tenantId, projectId, "STG-P0", "前期策划", 0, "NOT_STARTED");

        String body = """
                {"targetStatus":"APPROVED","comment":"非法跳转"}
                """;

        // Act
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/workflow/stages/" + stageId + ":transition", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);

        // Assert
        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4230, extractCode(resp.getBody()))
        );
    }

    // ── 门控决策 ──

    @Test
    @DisplayName("应该列出阶段下的门控决策")
    void shouldListGatesByStage() throws Exception {
        // Arrange
        UUID tenantId = createTestTenant("wf-api-gate-" + UUID.randomUUID());
        String email = "wf-api-gl+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-API-GL-" + UUID.randomUUID());
        UUID stageId = createStage(tenantId, projectId, "STG-P0", "前期策划", 0, "ACTIVE");
        createGate(tenantId, stageId, "GATE-P0", "PENDING", null);

        // Act
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/workflow/gates?stageId=" + stageId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray()),
                () -> assertEquals(1, data.size()),
                () -> assertEquals("GATE-P0", data.get(0).path("gateCode").asText())
        );
    }

    @Test
    @DisplayName("应该执行门控决策（PENDING → APPROVED）")
    void shouldDecideGate() throws Exception {
        // Arrange
        UUID tenantId = createTestTenant("wf-api-decide-" + UUID.randomUUID());
        String email = "wf-api-gd+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-API-GD-" + UUID.randomUUID());
        UUID stageId = createStage(tenantId, projectId, "STG-P0", "前期策划", 0, "ACTIVE");
        UUID gateId = createGate(tenantId, stageId, "GATE-P0", "PENDING", null);

        String body = """
                {"decision":"APPROVED","comment":"通过"}
                """;

        // Act
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/workflow/gates/" + gateId + ":decide", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);

        // Assert
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("APPROVED", data.path("decision").asText()),
                () -> assertEquals("DECIDED", data.path("status").asText())
        );
    }

    // ── 项目基线 ──

    @Test
    @DisplayName("应该列出项目基线（按版本号降序）")
    void shouldListBaselines() throws Exception {
        // Arrange
        UUID tenantId = createTestTenant("wf-api-bl-" + UUID.randomUUID());
        String email = "wf-api-bl+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-API-BL-" + UUID.randomUUID());
        createBaseline(tenantId, projectId, 1L, WorkflowRevisionStatus.PUBLISHED);
        createBaseline(tenantId, projectId, 2L, WorkflowRevisionStatus.DRAFT);

        // Act
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/workflow/baselines?projectId=" + projectId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray()),
                () -> assertEquals(2, data.size()),
                () -> assertEquals(2, data.get(0).path("revisionNo").asInt(), "首个应为高版本")
        );
    }

    @Test
    @DisplayName("应该获取基线详情")
    void shouldGetBaseline() throws Exception {
        // Arrange
        UUID tenantId = createTestTenant("wf-api-bg-" + UUID.randomUUID());
        String email = "wf-api-bg+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-API-BG-" + UUID.randomUUID());
        UUID baselineId = createBaseline(tenantId, projectId, 1L, WorkflowRevisionStatus.DRAFT);

        // Act
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/workflow/baselines/" + baselineId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(baselineId.toString(), data.path("id").asText()),
                () -> assertEquals("DRAFT", data.path("status").asText())
        );
    }

    @Test
    @DisplayName("应该冻结基线（DRAFT → PUBLISHED）")
    void shouldFreezeBaseline() throws Exception {
        // Arrange
        UUID tenantId = createTestTenant("wf-api-bf-" + UUID.randomUUID());
        String email = "wf-api-bf+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-API-BF-" + UUID.randomUUID());
        UUID baselineId = createBaseline(tenantId, projectId, 1L, WorkflowRevisionStatus.DRAFT);

        // Act
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/workflow/baselines/" + baselineId + ":freeze", HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("PUBLISHED", data.path("status").asText(),
                        "冻结后状态应为 PUBLISHED（DB 中 PUBLISHED 等价于契约的 frozen）"),
                () -> assertNotNull(data.path("frozenAt").asText(), "冻结后应填充 frozenAt")
        );
    }

    // ── 内部辅助方法 ──

    private UUID createProject(UUID tenantId, String accessToken, String projectCode) throws Exception {
        String body = """
                {"name":"工作流 API 测试项目","code":"%s"}
                """.formatted(projectCode);
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建项目失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

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
        return stageRepository.save(stage).getId();
    }

    private UUID createGate(UUID tenantId, UUID stageId, String gateCode,
                            String status, String decision) {
        WorkflowGateDecision gate = new WorkflowGateDecision();
        gate.setTenantId(tenantId);
        gate.setStageId(stageId);
        gate.setGateCode(gateCode);
        gate.setStatus(status);
        gate.setDecision(decision);
        gate.setClassification(DataClassification.PROJECT_RECORD);
        gate.setMetadata("{}");
        return gateRepository.save(gate).getId();
    }

    private UUID createBaseline(UUID tenantId, UUID projectId, Long revisionNo,
                                WorkflowRevisionStatus status) {
        WorkflowProjectBaseline baseline = new WorkflowProjectBaseline();
        baseline.setTenantId(tenantId);
        baseline.setProjectId(projectId);
        baseline.setRevisionNo(revisionNo);
        baseline.setStatus(status);
        baseline.setClassification(DataClassification.PROJECT_RECORD);
        baseline.setMetadata("{}");
        return baselineRepository.save(baseline).getId();
    }
}
