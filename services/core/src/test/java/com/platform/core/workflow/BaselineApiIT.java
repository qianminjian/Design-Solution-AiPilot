package com.platform.core.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.iam.domain.DataClassification;
import com.platform.core.testsupport.AbstractIntegrationTest;
import com.platform.core.workflow.domain.ProjectBaseline;
import com.platform.core.workflow.domain.RevisionStatus;
import com.platform.core.workflow.repository.ProjectBaselineRepository;
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
 * 工作流项目基线（ProjectBaseline）API 集成测试
 *
 * <p>覆盖 workflow 域基线端点：
 * <ul>
 *   <li>POST /api/v1/baselines/{baselineId}/freeze - 冻结基线（DRAFT → PUBLISHED）</li>
 *   <li>GET  /api/v1/baselines/{baselineId} - 查询基线详情</li>
 *   <li>GET  /api/v1/projects/{projectId}/baselines - 列出项目基线</li>
 * </ul>
 *
 * <p>核心不变量验证：
 * <ul>
 *   <li>冻结后 status 由 DRAFT 转为 PUBLISHED，frozen_at 填充</li>
 *   <li>已冻结（PUBLISHED）的基线不可再次冻结</li>
 * </ul>
 *
 * <p>测试数据通过 Repository 直接创建（workflow 域暂无创建基线 API）。
 */
@DisplayName("工作流项目基线（ProjectBaseline）API 集成测试")
class BaselineApiIT extends AbstractIntegrationTest {

    /** 项目端点（用于创建测试项目） */
    private static final String PROJECTS_URL = "/api/v1/projects";

    @Autowired
    private ProjectBaselineRepository baselineRepository;

    /**
     * 应该成功冻结 DRAFT 基线
     *
     * <p>DRAFT → PUBLISHED 为合法转换，frozen_at 应被填充。
     */
    @Test
    @DisplayName("应该成功冻结工作流 DRAFT 基线（DRAFT → PUBLISHED）")
    void shouldFreezeDraftBaseline() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("wf-bl-freeze-" + UUID.randomUUID());
        String email = "wf-bf+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-BF-" + UUID.randomUUID());
        UUID baselineId = createBaseline(tenantId, projectId, "V1 基线草稿", RevisionStatus.DRAFT, 1L);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/baselines/" + baselineId + "/freeze",
                HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)),
                String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("PUBLISHED", data.path("status").asText(),
                        "状态应已流转为 PUBLISHED"),
                () -> assertNotNull(data.path("frozenAt").asText(),
                        "冻结时间应已填充"),
                () -> assertEquals(baselineId.toString(), data.path("id").asText()),
                () -> assertEquals("V1 基线草稿", data.path("name").asText(),
                        "基线名称应一致")
        );
    }

    /**
     * 应该拒绝再次冻结已冻结基线
     *
     * <p>PUBLISHED 状态基线不可再次冻结，应返回 422 + BASELINE_NOT_FROZEN。
     */
    @Test
    @DisplayName("应该拒绝再次冻结已冻结基线（422 + BASELINE_NOT_FROZEN）")
    void shouldRejectFreezeFrozenBaseline() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("wf-bl-reject-" + UUID.randomUUID());
        String email = "wf-br+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-BR-" + UUID.randomUUID());
        // 创建已冻结（PUBLISHED）基线
        UUID baselineId = createBaseline(tenantId, projectId, "已冻结基线", RevisionStatus.PUBLISHED, 1L);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/baselines/" + baselineId + "/freeze",
                HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)),
                String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4233, extractCode(resp.getBody()),
                        "业务码应为 BASELINE_NOT_FROZEN（4233）")
        );
    }

    /**
     * 应该查询基线详情
     */
    @Test
    @DisplayName("应该查询工作流基线详情")
    void shouldGetBaselineById() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("wf-bl-get-" + UUID.randomUUID());
        String email = "wf-bg+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-BG-" + UUID.randomUUID());
        UUID baselineId = createBaseline(tenantId, projectId, "详情测试基线", RevisionStatus.DRAFT, 1L);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/baselines/" + baselineId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(baselineId.toString(), data.path("id").asText()),
                () -> assertEquals("详情测试基线", data.path("name").asText()),
                () -> assertEquals("DRAFT", data.path("status").asText()),
                () -> assertEquals(1, data.path("revisionNo").asLong(),
                        "修订号应为 1"),
                () -> assertEquals(projectId.toString(), data.path("projectId").asText())
        );
    }

    /**
     * 应该按项目 ID 列出基线（按修订号倒序）
     */
    @Test
    @DisplayName("应该按项目 ID 列出工作流基线（按修订号倒序）")
    void shouldListBaselinesByProject() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("wf-bl-list-" + UUID.randomUUID());
        String email = "wf-bl+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);

        UUID projectId = createProject(tenantId, accessToken, "WF-BL-" + UUID.randomUUID());
        createBaseline(tenantId, projectId, "V1 基线", RevisionStatus.PUBLISHED, 1L);
        createBaseline(tenantId, projectId, "V2 基线", RevisionStatus.DRAFT, 2L);
        createBaseline(tenantId, projectId, "V3 基线", RevisionStatus.DRAFT, 3L);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/projects/" + projectId + "/baselines", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray(), "基线列表应为数组"),
                () -> assertEquals(3, data.size(), "应返回 3 个基线"),
                () -> assertEquals(3, data.get(0).path("revisionNo").asLong(),
                        "首个基线修订号应为 3（倒序）"),
                () -> assertEquals(1, data.get(2).path("revisionNo").asLong(),
                        "末个基线修订号应为 1（倒序）")
        );
    }

    // ── 内部辅助方法 ──

    /**
     * 通过 portfolio API 创建项目并返回项目 ID
     */
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

    /**
     * 通过 Repository 直接创建工作流项目基线
     */
    private UUID createBaseline(UUID tenantId, UUID projectId, String name,
                                RevisionStatus status, long revisionNo) {
        ProjectBaseline baseline = new ProjectBaseline();
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
