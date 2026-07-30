package com.platform.core.change.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.platform.core.change.domain.enums.ChangePriority;
import com.platform.core.change.domain.enums.ChangeStatus;
import com.platform.core.change.domain.enums.ChangeType;
import com.platform.core.change.request.domain.ChangeRequest;
import com.platform.core.change.request.repository.ChangeRequestRepository;
import com.platform.core.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * ChangeRequest Controller API 集成测试（D37.16 P12 变更影响与闭环工作台）
 *
 * <p>验证 /api/v1/changes 端点的完整 API 链路：
 * <ul>
 *   <li>POST   /                       创建草稿</li>
 *   <li>GET    /                       列表查询（含状态过滤）</li>
 *   <li>GET    /{id}                   详情查询（存在、不存在、跨租户隔离）</li>
 *   <li>PUT    /{id}                   更新草稿</li>
 *   <li>DELETE /{id}                   删除草稿</li>
 *   <li>POST   /{id}/approve           批准变更（含职责分离、stepUpToken 校验）</li>
 *   <li>POST   /{id}/recall            撤回变更（仅发起人可撤回）</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.16
 */
@DisplayName("ChangeRequest Controller API 集成测试")
class ChangeRequestControllerApiIT extends AbstractIntegrationTest {

    private static final String BASE_URL = "/api/v1/changes";

    @Autowired
    private ChangeRequestRepository changeRequestRepository;

    // ── POST 创建 ──

    @Test
    @DisplayName("POST /api/v1/changes 应创建 DRAFT 状态变更请求")
    void shouldCreateDraftChangeRequest() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {
                  "title": "测试变更请求",
                  "description": "API 集成测试创建",
                  "type": "DESIGN_CHANGE",
                  "priority": "NORMAL",
                  "projectId": "PROJ-API-001"
                }
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.path("code").asText().startsWith("CHG-"),
                        "code 应以 CHG- 前缀"),
                () -> assertEquals("测试变更请求", data.path("title").asText()),
                () -> assertEquals("DESIGN_CHANGE", data.path("type").asText()),
                () -> assertEquals("NORMAL", data.path("priority").asText()),
                () -> assertEquals("DRAFT", data.path("status").asText()),
                () -> assertEquals(ctx.principalId().toString(), data.path("initiatedBy").asText()),
                () -> assertTrue(data.path("confirmedNoImpact").asBoolean() == false,
                        "草稿状态 confirmedNoImpact 应为 false"),
                () -> assertTrue(data.path("isAiAssisted").asBoolean() == false,
                        "草稿状态 isAiAssisted 应为 false")
        );
    }

    @Test
    @DisplayName("POST /api/v1/changes 缺少 x-user-id 头应返回 401")
    void shouldReturn401WhenCreateWithoutUserId() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        String body = """
                {"title":"测试","type":"DESIGN_CHANGE","priority":"NORMAL","projectId":"PROJ-001"}
                """;

        // Act（执行）：不携带 x-user-id 头
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    // ── GET 列表查询 ──

    @Test
    @DisplayName("GET /api/v1/changes 空列表应返回 200 + 空 list")
    void shouldReturnEmptyListWhenNoData() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(data.has("list"), "响应应包含 list 字段"),
                () -> assertEquals(0, data.path("list").size(), "空租户应返回空列表"),
                () -> assertEquals(0, data.path("total").asInt())
        );
    }

    @Test
    @DisplayName("GET /api/v1/changes 有数据时应返回 list 非空")
    void shouldReturnNonEmptyListWhenDataExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        ChangeRequest saved = changeRequestRepository.save(
                buildSampleChangeRequest(ctx.tenantId(), "CHG-API-LIST-001",
                        ChangeStatus.DRAFT, "PROJ-LIST",
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.path("list").size() >= 1, "应至少有 1 条变更请求"),
                () -> assertEquals(saved.getId().toString(),
                        data.path("list").get(0).path("id").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/changes?status=DRAFT 应按状态过滤")
    void shouldFilterByStatus() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        changeRequestRepository.save(buildSampleChangeRequest(
                ctx.tenantId(), "CHG-FILTER-DRAFT", ChangeStatus.DRAFT,
                "PROJ-FILTER", ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        changeRequestRepository.save(buildSampleChangeRequest(
                ctx.tenantId(), "CHG-FILTER-APPROVED", ChangeStatus.APPROVED,
                "PROJ-FILTER", ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "?status=DRAFT&page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("list").size(), "应只返回 1 条 DRAFT 变更"),
                () -> assertEquals("DRAFT", data.path("list").get(0).path("status").asText())
        );
    }

    // ── GET 详情查询 ──

    @Test
    @DisplayName("GET /api/v1/changes/{id} 存在的 ID 应返回详情")
    void shouldReturnDetailWhenIdExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        ChangeRequest saved = changeRequestRepository.save(
                buildSampleChangeRequest(ctx.tenantId(), "CHG-DETAIL-001",
                        ChangeStatus.DRAFT, "PROJ-DETAIL",
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(saved.getId().toString(), data.path("id").asText()),
                () -> assertEquals("CHG-DETAIL-001", data.path("code").asText()),
                () -> assertEquals("DRAFT", data.path("status").asText()),
                () -> assertEquals("DESIGN_CHANGE", data.path("type").asText())
        );
    }

    @Test
    @DisplayName("GET /api/v1/changes/{id} 不存在的 ID 应返回 404")
    void shouldReturn404WhenIdNotExists() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        UUID randomId = UUID.randomUUID();

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + randomId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    @Test
    @DisplayName("GET /api/v1/changes/{id} 跨租户应返回 404")
    void shouldReturn404WhenCrossTenantAccess() throws Exception {
        // Arrange（准备）
        TestContext ctxA = createContext();
        TestContext ctxB = createContext();
        ChangeRequest savedInA = changeRequestRepository.save(
                buildSampleChangeRequest(ctxA.tenantId(), "CHG-CROSS-001",
                        ChangeStatus.DRAFT, "PROJ-CROSS",
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));

        // Act（执行）：用租户 B 的 token 查询租户 A 的变更
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + savedInA.getId(), HttpMethod.GET,
                new HttpEntity<>(withAccessToken(ctxB.tenantId(), ctxB.accessToken())), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.NOT_FOUND, resp.getStatusCode());
    }

    // ── PUT 更新 ──

    @Test
    @DisplayName("PUT /api/v1/changes/{id} 应更新草稿标题")
    void shouldUpdateDraftTitle() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        ChangeRequest saved = changeRequestRepository.save(
                buildSampleChangeRequest(ctx.tenantId(), "CHG-UPDATE-001",
                        ChangeStatus.DRAFT, "PROJ-UPDATE",
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        String body = """
                {
                  "title": "更新后的标题",
                  "description": "更新后的描述",
                  "type": "DESIGN_CHANGE",
                  "priority": "MAJOR",
                  "projectId": "PROJ-UPDATE"
                }
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId(), HttpMethod.PUT,
                new HttpEntity<>(body, withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("更新后的标题", data.path("title").asText()),
                () -> assertEquals("MAJOR", data.path("priority").asText())
        );
    }

    // ── DELETE 删除 ──

    @Test
    @DisplayName("DELETE /api/v1/changes/{id} 应删除草稿")
    void shouldDeleteDraftChangeRequest() throws Exception {
        // Arrange（准备）
        TestContext ctx = createContext();
        ChangeRequest saved = changeRequestRepository.save(
                buildSampleChangeRequest(ctx.tenantId(), "CHG-DELETE-001",
                        ChangeStatus.DRAFT, "PROJ-DELETE",
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId(), HttpMethod.DELETE,
                new HttpEntity<>(withAccessToken(ctx.tenantId(), ctx.accessToken())), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertTrue(changeRequestRepository.findById(saved.getId()).isEmpty(),
                        "删除后应查询不到记录")
        );
    }

    // ── POST approve 批准 ──

    @Test
    @DisplayName("POST /api/v1/changes/{id}/approve 应将 PENDING_APPROVAL 改为 APPROVED")
    void shouldApproveChangeRequest() throws Exception {
        // Arrange（准备）：发起人 A 创建变更，批准人 B 批准
        TestContext ctxInitiator = createContext();
        ChangeRequest saved = changeRequestRepository.save(
                buildSampleChangeRequest(ctxInitiator.tenantId(), "CHG-APPROVE-001",
                        ChangeStatus.PENDING_APPROVAL, "PROJ-APPROVE",
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        // 设置发起人为 principalA，批准人用 principalB
        saved.setInitiatedBy(ctxInitiator.principalId().toString());
        changeRequestRepository.save(saved);

        TestContext ctxApprover = createContextInTenant(ctxInitiator.tenantId());
        String body = """
                {"comment":"批准通过","stepUpToken":"valid-token","responsibilityAcknowledged":true}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/approve", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctxApprover)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("APPROVED", data.path("status").asText()),
                () -> assertEquals(ctxApprover.principalId().toString(),
                        data.path("approvedBy").asText()),
                () -> assertNotNull(data.path("approvedAt").asText())
        );
    }

    @Test
    @DisplayName("POST /api/v1/changes/{id}/approve 批准人等于发起人应返回 403")
    void shouldReturn403WhenApproverEqualsInitiator() throws Exception {
        // Arrange（准备）：同一 principal 既创建又批准
        TestContext ctx = createContext();
        ChangeRequest saved = changeRequestRepository.save(
                buildSampleChangeRequest(ctx.tenantId(), "CHG-SOD-001",
                        ChangeStatus.PENDING_APPROVAL, "PROJ-SOD",
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        saved.setInitiatedBy(ctx.principalId().toString());
        changeRequestRepository.save(saved);
        String body = """
                {"comment":"自己批准自己","stepUpToken":"valid-token","responsibilityAcknowledged":true}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/approve", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctx)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.FORBIDDEN, resp.getStatusCode()),
                () -> assertNotEqualsZeroCode(resp.getBody())
        );
    }

    @Test
    @DisplayName("POST /api/v1/changes/{id}/approve 缺少 stepUpToken 应返回 4xx")
    void shouldReturn4xxWhenMissingStepUpToken() throws Exception {
        // Arrange（准备）
        TestContext ctxInitiator = createContext();
        ChangeRequest saved = changeRequestRepository.save(
                buildSampleChangeRequest(ctxInitiator.tenantId(), "CHG-NOTOKEN-001",
                        ChangeStatus.PENDING_APPROVAL, "PROJ-NOTOKEN",
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        saved.setInitiatedBy(ctxInitiator.principalId().toString());
        changeRequestRepository.save(saved);

        TestContext ctxApprover = createContextInTenant(ctxInitiator.tenantId());
        String body = """
                {"comment":"缺少 token","stepUpToken":"","responsibilityAcknowledged":true}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/approve", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctxApprover)), String.class);

        // Assert（断言）
        assertTrue(resp.getStatusCode().is4xxClientError(),
                "缺少 stepUpToken 应返回 4xx: " + resp.getStatusCode());
    }

    // ── POST recall 撤回 ──

    @Test
    @DisplayName("POST /api/v1/changes/{id}/recall 非发起人应返回 403")
    void shouldReturn403WhenRecallByNonInitiator() throws Exception {
        // Arrange（准备）：发起人 A，撤回人 B
        TestContext ctxInitiator = createContext();
        ChangeRequest saved = changeRequestRepository.save(
                buildSampleChangeRequest(ctxInitiator.tenantId(), "CHG-RECALL-001",
                        ChangeStatus.PENDING_APPROVAL, "PROJ-RECALL",
                        ChangeType.DESIGN_CHANGE, ChangePriority.NORMAL));
        saved.setInitiatedBy(ctxInitiator.principalId().toString());
        changeRequestRepository.save(saved);

        TestContext ctxRecaller = createContextInTenant(ctxInitiator.tenantId());
        String body = """
                {"reason":"非发起人尝试撤回","stepUpToken":"valid-token"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                BASE_URL + "/" + saved.getId() + "/recall", HttpMethod.POST,
                new HttpEntity<>(body, withUserHeaders(ctxRecaller)), String.class);

        // Assert（断言）
        assertEquals(HttpStatus.FORBIDDEN, resp.getStatusCode());
    }

    // ── 辅助方法 ──

    /**
     * 创建独立测试上下文（租户 + 主体 + access token）
     */
    private TestContext createContext() {
        UUID tenantId = createTestTenant("tenant-chg-api-" + UUID.randomUUID());
        return createContextInTenant(tenantId);
    }

    /**
     * 在已有租户中创建新主体（用于职责分离测试）
     */
    private TestContext createContextInTenant(UUID tenantId) {
        String email = "chg-api+" + UUID.randomUUID() + "@example.com";
        UUID principalId = createTestPrincipal(tenantId, email);
        String token = loginAndGetAccessToken(tenantId, email);
        return new TestContext(tenantId, token, principalId);
    }

    /**
     * 构造带 x-user-id 头的请求头（写操作端点需要）
     */
    private org.springframework.http.HttpHeaders withUserHeaders(TestContext ctx) {
        org.springframework.http.HttpHeaders headers = withAccessToken(ctx.tenantId(), ctx.accessToken());
        headers.set("x-user-id", ctx.principalId().toString());
        return headers;
    }

    /**
     * 构造测试用 ChangeRequest（全参数版本）
     */
    private ChangeRequest buildSampleChangeRequest(
            UUID tenantId, String code, ChangeStatus status, String projectId,
            ChangeType type, ChangePriority priority) {
        ChangeRequest entity = new ChangeRequest();
        entity.setTenantId(tenantId);
        entity.setCode(code);
        entity.setTitle("测试变更-" + code);
        entity.setDescription("API 集成测试用变更请求");
        entity.setType(type);
        entity.setPriority(priority);
        entity.setStatus(status);
        entity.setProjectId(projectId);
        entity.setInitiatedBy("initiator@platform.local");
        entity.setInitiatedAt(Instant.now());
        entity.setConfirmedNoImpact(false);
        entity.setAiAssisted(false);
        return entity;
    }

    /**
     * 断言业务码非 0（用于错误场景）
     */
    private int assertNotEqualsZeroCode(String body) throws Exception {
        int code = extractCode(body);
        assertTrue(code != 0, "业务码应非 0（表示错误）: " + body);
        return code;
    }

    /**
     * 测试上下文：包含 tenantId、accessToken 和 principalId
     *
     * <p>principalId 在构造时固定，用于 x-user-id 头。
     */
    private record TestContext(UUID tenantId, String accessToken, UUID principalId) {
    }
}
