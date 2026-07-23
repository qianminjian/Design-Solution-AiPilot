package com.platform.core.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.iam.domain.DataClassification;
import com.platform.core.testsupport.AbstractIntegrationTest;
import com.platform.core.workflow.domain.WorkflowProjectBaseline;
import com.platform.core.workflow.domain.WorkflowRevisionStatus;
import com.platform.core.workflow.repository.WorkflowProjectBaselineRepository;
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

@DisplayName("工作流项目基线（ProjectBaseline）API 集成测试")
class BaselineApiIT extends AbstractIntegrationTest {

    private static final String PROJECTS_URL = "/api/v1/projects";

    @Autowired
    private WorkflowProjectBaselineRepository baselineRepository;

    @Test
    @DisplayName("应该成功冻结工作流 DRAFT 基线（DRAFT → PUBLISHED）")
    void shouldFreezeDraftBaseline() throws Exception {
        UUID tenantId = createTestTenant("wf-bl-freeze-" + UUID.randomUUID());
        String email = "wf-bf+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-BF-" + UUID.randomUUID());
        UUID baselineId = createBaseline(tenantId, projectId, "V1 基线草稿", WorkflowRevisionStatus.DRAFT, 1L);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/baselines/" + baselineId + "/freeze",
                HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)),
                String.class);

        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("PUBLISHED", data.path("status").asText()),
                () -> assertNotNull(data.path("frozenAt").asText()),
                () -> assertEquals(baselineId.toString(), data.path("id").asText()),
                () -> assertEquals("V1 基线草稿", data.path("name").asText())
        );
    }

    @Test
    @DisplayName("应该拒绝再次冻结已冻结基线（422 + BASELINE_NOT_FROZEN）")
    void shouldRejectFreezeFrozenBaseline() throws Exception {
        UUID tenantId = createTestTenant("wf-bl-reject-" + UUID.randomUUID());
        String email = "wf-br+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-BR-" + UUID.randomUUID());
        UUID baselineId = createBaseline(tenantId, projectId, "已冻结基线", WorkflowRevisionStatus.PUBLISHED, 1L);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/baselines/" + baselineId + "/freeze",
                HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)),
                String.class);

        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4233, extractCode(resp.getBody()))
        );
    }

    @Test
    @DisplayName("应该查询工作流基线详情")
    void shouldGetBaselineById() throws Exception {
        UUID tenantId = createTestTenant("wf-bl-get-" + UUID.randomUUID());
        String email = "wf-bg+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-BG-" + UUID.randomUUID());
        UUID baselineId = createBaseline(tenantId, projectId, "详情测试基线", WorkflowRevisionStatus.DRAFT, 1L);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/baselines/" + baselineId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(baselineId.toString(), data.path("id").asText()),
                () -> assertEquals("详情测试基线", data.path("name").asText()),
                () -> assertEquals("DRAFT", data.path("status").asText()),
                () -> assertEquals(1, data.path("revisionNo").asLong()),
                () -> assertEquals(projectId.toString(), data.path("projectId").asText())
        );
    }

    @Test
    @DisplayName("应该按项目 ID 列出工作流基线（按修订号倒序）")
    void shouldListBaselinesByProject() throws Exception {
        UUID tenantId = createTestTenant("wf-bl-list-" + UUID.randomUUID());
        String email = "wf-bl+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-BL-" + UUID.randomUUID());
        createBaseline(tenantId, projectId, "V1 基线", WorkflowRevisionStatus.PUBLISHED, 1L);
        createBaseline(tenantId, projectId, "V2 基线", WorkflowRevisionStatus.DRAFT, 2L);
        createBaseline(tenantId, projectId, "V3 基线", WorkflowRevisionStatus.DRAFT, 3L);

        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/projects/" + projectId + "/baselines", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray()),
                () -> assertEquals(3, data.size()),
                () -> assertEquals(3, data.get(0).path("revisionNo").asLong()),
                () -> assertEquals(1, data.get(2).path("revisionNo").asLong())
        );
    }

    private UUID createProject(UUID tenantId, String accessToken, String projectCode) throws Exception {
        String body = """
                {"name":"工作流基线测试项目","code":"%s"}
                """.formatted(projectCode);
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建项目失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

    private UUID createBaseline(UUID tenantId, UUID projectId, String name,
                                WorkflowRevisionStatus status, long revisionNo) {
        WorkflowProjectBaseline baseline = new WorkflowProjectBaseline();
        baseline.setTenantId(tenantId);
        baseline.setProjectId(projectId);
        baseline.setRevisionNo(revisionNo);
        baseline.setName(name);
        baseline.setStatus(status);
        baseline.setClassification(DataClassification.PUBLISHED_EVIDENCE);
        baseline.setMetadata("{}");
        return baselineRepository.save(baseline).getId();
    }
}