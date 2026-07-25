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

@DisplayName("工作流门禁决策（GateDecision）API 集成测试")
class GateApiIT extends AbstractIntegrationTest {

    private static final String PROJECTS_URL = "/api/v1/projects";

    @Autowired
    private WorkflowStageInstanceRepository stageInstanceRepository;

    @Autowired
    private WorkflowGateDecisionRepository gateDecisionRepository;

    @Autowired
    private WorkflowProjectBaselineRepository baselineRepository;

    @Test
    @DisplayName("应该成功提交工作流门禁决策（APPROVED）")
    void shouldDecideGate() throws Exception {
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

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/workflow/gates/" + gateId + ":decide",
                HttpMethod.POST,
                new HttpEntity<>(decideBody, withAccessToken(tenantId, accessToken)),
                String.class);

        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("DECIDED", data.path("status").asText()),
                () -> assertEquals("APPROVED", data.path("decision").asText()),
                () -> assertNotNull(data.path("decidedAt").asText()),
                () -> assertEquals(gateId.toString(), data.path("id").asText())
        );
    }

    @Test
    @DisplayName("应该拒绝引用未冻结基线（422 + BASELINE_NOT_FROZEN）")
    void shouldRejectUnfrozenBaseline() throws Exception {
        UUID tenantId = createTestTenant("wf-gate-baseline-" + UUID.randomUUID());
        String email = "wf-gb+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-GB-" + UUID.randomUUID());
        UUID stageId = createStage(tenantId, projectId, "STG-P0", "前期策划与需求门", 0, "UNDER_REVIEW");
        UUID gateId = createGate(tenantId, projectId, stageId, "G0", "前期策划门");
        UUID draftBaselineId = createBaseline(tenantId, projectId, "DRAFT 基线", WorkflowRevisionStatus.DRAFT);

        String decideBody = """
                {"decision":"APPROVED","comment":"引用未冻结基线","baselineId":"%s","evidence":[]}
                """.formatted(draftBaselineId);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/workflow/gates/" + gateId + ":decide",
                HttpMethod.POST,
                new HttpEntity<>(decideBody, withAccessToken(tenantId, accessToken)),
                String.class);

        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4233, extractCode(resp.getBody()))
        );
    }

    @Test
    @DisplayName("应该按阶段 ID 列出工作流门禁决策")
    void shouldListGatesByStage() throws Exception {
        UUID tenantId = createTestTenant("wf-gate-list-" + UUID.randomUUID());
        String email = "wf-gl+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-GL-" + UUID.randomUUID());
        UUID stageId = createStage(tenantId, projectId, "STG-P0", "前期策划与需求门", 0, "UNDER_REVIEW");
        createGate(tenantId, projectId, stageId, "G0", "前期策划门");
        createGate(tenantId, projectId, stageId, "G0-REVIEW", "前期策划复核门");

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/workflow/gates?stageId=" + stageId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray()),
                () -> assertEquals(2, data.size()),
                () -> assertEquals("G0-REVIEW", data.get(0).path("gateCode").asText(),
                        "按创建时间倒序：后创建的 G0-REVIEW 应在前"),
                () -> assertEquals(stageId.toString(), data.get(0).path("stageId").asText())
        );
    }

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
        return stageInstanceRepository.save(stage).getId();
    }

    private UUID createGate(UUID tenantId, UUID projectId, UUID stageId,
                            String gateCode, String gateName) {
        WorkflowGateDecision gate = new WorkflowGateDecision();
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

    private UUID createBaseline(UUID tenantId, UUID projectId, String name, WorkflowRevisionStatus status) {
        WorkflowProjectBaseline baseline = new WorkflowProjectBaseline();
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