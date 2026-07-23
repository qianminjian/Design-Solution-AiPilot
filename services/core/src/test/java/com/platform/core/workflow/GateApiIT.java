package com.platform.core.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.iam.domain.DataClassification;
import com.platform.core.testsupport.AbstractIntegrationTest;
import com.platform.core.workflow.domain.GateDecision;
import com.platform.core.workflow.domain.ProjectBaseline;
import com.platform.core.workflow.domain.RevisionStatus;
import com.platform.core.workflow.domain.StageInstance;
import com.platform.core.workflow.repository.GateDecisionRepository;
import com.platform.core.workflow.repository.ProjectBaselineRepository;
import com.platform.core.workflow.repository.StageInstanceRepository;
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
 * 工作流门禁决策（GateDecision）API 集成测试
 *
 * <p>覆盖 workflow 域门禁端点：
 * <ul>
 *   <li>POST /api/v1/gates/{gateId}/decision - 提交门禁决策</li>
 *   <li>GET  /api/v1/stages/{stageId}/gates - 列出阶段关联门禁</li>
 * </ul>
 *
 * <p>核心不变量验证：
 * <ul>
 *   <li>决策后 status 由 PENDING 转为 DECIDED</li>
 *   <li>引用未冻结（非 PUBLISHED）基线时拒绝（422 + BASELINE_NOT_FROZEN）</li>
 * </ul>
 *
 * <p>测试数据通过 Repository 直接创建（workflow 域暂无创建门禁/基线 API）。
 */
@DisplayName("工作流门禁决策（GateDecision）API 集成测试")
class GateApiIT extends AbstractIntegrationTest {

    /** 项目端点（用于创建测试项目） */
    private static final String PROJECTS_URL = "/api/v1/projects";

    @Autowired
    private StageInstanceRepository stageInstanceRepository;

    @Autowired
    private GateDecisionRepository gateDecisionRepository;

    @Autowired
    private ProjectBaselineRepository baselineRepository;

    /**
     * 应该成功提交门禁决策
     *
     * <p>PENDING → DECIDED 为合法转换，decision=APPROVED 时返回更新后的门禁实例。
     */
    @Test
    @DisplayName("应该成功提交工作流门禁决策（APPROVED）")
    void shouldDecideGate() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("wf-gate-decide-" + UUID.randomUUID());
        String email = "wf-gd+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-GD-" + UUID.randomUUID());
        UUID stageId = createStage(tenantId, projectId, "STG-P0", "前期策划与需求门", 0, "UNDER_REVIEW");
        UUID gateId = createGate(tenantId, projectId, stageId, "G0", "前期策划门");

        String decideBody = """
                {"decision":"APPROVED","comment":"通过门禁","evidence":[]}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/gates/" + gateId + "/decision",
                HttpMethod.POST,
                new HttpEntity<>(decideBody, withAccessToken(tenantId, accessToken)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("DECIDED", data.path("status").asText(),
                        "状态应已流转为 DECIDED"),
                () -> assertEquals("APPROVED", data.path("decision").asText(),
                        "决策结论应为 APPROVED"),
                () -> assertNotNull(data.path("decidedAt").asText(),
                        "决策时间应已填充"),
                () -> assertEquals(gateId.toString(), data.path("id").asText())
        );
    }

    /**
     * 应该拒绝引用未冻结基线
     *
     * <p>核心不变量：baseline_id 必须引用 PUBLISHED 状态基线。
     * 引用 DRAFT 状态基线应返回 422 + BASELINE_NOT_FROZEN。
     */
    @Test
    @DisplayName("应该拒绝引用未冻结基线（422 + BASELINE_NOT_FROZEN）")
    void shouldRejectUnfrozenBaseline() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("wf-gate-baseline-" + UUID.randomUUID());
        String email = "wf-gb+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-GB-" + UUID.randomUUID());
        UUID stageId = createStage(tenantId, projectId, "STG-P0", "前期策划与需求门", 0, "UNDER_REVIEW");
        UUID gateId = createGate(tenantId, projectId, stageId, "G0", "前期策划门");
        // 创建 DRAFT 状态基线（未冻结）
        UUID draftBaselineId = createBaseline(tenantId, projectId, "DRAFT 基线", RevisionStatus.DRAFT);

        String decideBody = """
                {"decision":"APPROVED","comment":"引用未冻结基线","baselineId":"%s","evidence":[]}
                """.formatted(draftBaselineId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/gates/" + gateId + "/decision",
                HttpMethod.POST,
                new HttpEntity<>(decideBody, withAccessToken(tenantId, accessToken)),
                String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4233, extractCode(resp.getBody()),
                        "业务码应为 BASELINE_NOT_FROZEN（4233）")
        );
    }

    /**
     * 应该按阶段 ID 列出门禁决策
     */
    @Test
    @DisplayName("应该按阶段 ID 列出工作流门禁决策")
    void shouldListGatesByStage() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("wf-gate-list-" + UUID.randomUUID());
        String email = "wf-gl+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-GL-" + UUID.randomUUID());
        UUID stageId = createStage(tenantId, projectId, "STG-P0", "前期策划与需求门", 0, "UNDER_REVIEW");
        createGate(tenantId, projectId, stageId, "G0", "前期策划门");
        createGate(tenantId, projectId, stageId, "G0-REVIEW", "前期策划复核门");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/stages/" + stageId + "/gates", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray(), "门禁列表应为数组"),
                () -> assertEquals(2, data.size(), "应返回 2 个门禁"),
                () -> assertEquals("G0", data.get(0).path("gateCode").asText(),
                        "首个门禁编码应为 G0"),
                () -> assertEquals(stageId.toString(), data.get(0).path("stageId").asText(),
                        "门禁 stageId 应一致")
        );
    }

    // ── 内部辅助方法 ──

    /**
     * 通过 portfolio API 创建项目并返回项目 ID
     */
    private UUID createProject(UUID tenantId, String accessToken, String projectCode) throws Exception {
        String body = """
                {"name":"工作流门禁测试项目","code":"%s"}
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
        StageInstance stage = new StageInstance();
        stage.setTenantId(tenantId);
        stage.setProjectId(projectId);
        stage.setStageCode(stageCode);
        stage.setStageName(stageName);
        stage.setStageOrder(stageOrder);
        stage.setStatus(status);
        stage.setClassification(DataClassification.PROJECT_RECORD);
        stage.setMetadata("{}");
        return stageInstanceRepository.save(stage).getId();
    }

    /**
     * 通过 Repository 直接创建工作流门禁决策
     */
    private UUID createGate(UUID tenantId, UUID projectId, UUID stageId,
                            String gateCode, String gateName) {
        GateDecision gate = new GateDecision();
        gate.setTenantId(tenantId);
        gate.setProjectId(projectId);
        gate.setStageId(stageId);
        gate.setGateCode(gateCode);
        gate.setGateName(gateName);
        gate.setStatus("PENDING");
        gate.setClassification(DataClassification.PUBLISHED_EVIDENCE);
        gate.setEvidence("[]");
        gate.setMetadata("{}");
        return gateDecisionRepository.save(gate).getId();
    }

    /**
     * 通过 Repository 直接创建工作流项目基线
     */
    private UUID createBaseline(UUID tenantId, UUID projectId, String name, RevisionStatus status) {
        ProjectBaseline baseline = new ProjectBaseline();
        baseline.setTenantId(tenantId);
        baseline.setProjectId(projectId);
        baseline.setRevisionNo(1L);
        baseline.setName(name);
        baseline.setStatus(status);
        baseline.setClassification(DataClassification.PUBLISHED_EVIDENCE);
        baseline.setMetadata("{}");
        return baselineRepository.save(baseline).getId();
    }
}
