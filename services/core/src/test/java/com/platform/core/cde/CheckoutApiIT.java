package com.platform.core.cde;

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
 * 文档检入检出（Checkout/Checkin）API 集成测试
 *
 * <p>覆盖状态机流转与并发互斥规则（D07 CDE 领域版本）：
 * <ul>
 *   <li>POST /api/v1/documents/{id}/checkout —— 检出（DRAFT/PUBLISHED → CHECKED_OUT）</li>
 *   <li>POST /api/v1/documents/{id}/checkin —— 检入（CHECKED_OUT → PUBLISHED，创建新版本）</li>
 * </ul>
 *
 * <p>状态机：DRAFT ──checkout──→ CHECKED_OUT ──checkin──→ PUBLISHED ──checkout──→ CHECKED_OUT
 */
@DisplayName("文档检入检出（Checkout/Checkin）API 集成测试")
class CheckoutApiIT extends AbstractIntegrationTest {

    /** 项目端点 */
    private static final String PROJECTS_URL = "/api/v1/projects";
    /** 64 位 SHA-256 测试校验和（全 a） */
    private static final String TEST_CHECKSUM = "a".repeat(64);

    /**
     * 应该成功检出 DRAFT 状态文档
     *
     * <p>新建文档初始状态为 DRAFT，检出后流转为 CHECKED_OUT，
     * 响应应包含检出人与检出时间。
     */
    @Test
    @DisplayName("应该成功检出 DRAFT 状态文档")
    void shouldCheckoutDraftDocumentSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-co-tenant-" + UUID.randomUUID());
        String email = "cde-co+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkout", HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(documentId.toString(), data.path("documentId").asText()),
                () -> assertEquals("CHECKED_OUT", data.path("status").asText(),
                        "检出后状态应为 CHECKED_OUT"),
                () -> assertTrue(data.path("checkedOutBy").asText().length() > 0,
                        "checkedOutBy 应非空"),
                () -> assertTrue(data.path("checkedOutAt").asText().length() > 0,
                        "checkedOutAt 应非空")
        );
    }

    /**
     * 应该拒绝重复检出 CHECKED_OUT 状态文档
     *
     * <p>文档已被检出后再次检出应返回 422 + DOCUMENT_CHECKED_OUT（4238）。
     */
    @Test
    @DisplayName("应该拒绝重复检出（422 + 4238）")
    void shouldRejectDoubleCheckout() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-dco-tenant-" + UUID.randomUUID());
        String email = "cde-dco+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId);

        // 首次检出（成功）
        restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkout", HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Act（执行）—— 再次检出应失败
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkout", HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4238, extractCode(resp.getBody()),
                        "业务码应为 DOCUMENT_CHECKED_OUT（4238）")
        );
    }

    /**
     * 应该成功检出 PUBLISHED 状态文档
     *
     * <p>已发布文档可再次检出进入编辑态：PUBLISHED → CHECKED_OUT。
     * 前置：先 checkout → checkin 让文档进入 PUBLISHED，再 checkout。
     */
    @Test
    @DisplayName("应该成功检出 PUBLISHED 状态文档")
    void shouldCheckoutPublishedDocument() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-pco-tenant-" + UUID.randomUUID());
        String email = "cde-pco+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId);

        // 先完成一次 checkout → checkin 让文档进入 PUBLISHED
        restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkout", HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);
        String checkinBody = """
                {"comment":"首版发布","storageKey":"s3://v2","checksum":"%s","sizeBytes":2048}
                """.formatted("b".repeat(64));
        restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkin", HttpMethod.POST,
                new HttpEntity<>(checkinBody, withAccessToken(tenantId, accessToken)), String.class);

        // Act（执行）—— 对 PUBLISHED 文档再次检出
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkout", HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("CHECKED_OUT", data.path("status").asText(),
                        "PUBLISHED 文档应可再次检出")
        );
    }

    /**
     * 应该成功检入并创建 PUBLISHED 版本
     *
     * <p>检入后文档状态从 CHECKED_OUT 流转为 PUBLISHED，
     * 同时创建新版本（versionNumber 自增），响应返回新版本 DTO。
     */
    @Test
    @DisplayName("应该成功检入并创建 PUBLISHED 版本")
    void shouldCheckinDocumentSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-ci-tenant-" + UUID.randomUUID());
        String email = "cde-ci+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId);

        // 先检出
        restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkout", HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        String checkinBody = """
                {"comment":"检入发布版本","storageKey":"s3://bucket/v2.dwg","checksum":"%s","sizeBytes":2048,"mimeType":"application/acad"}
                """.formatted("c".repeat(64));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkin", HttpMethod.POST,
                new HttpEntity<>(checkinBody, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(2, data.path("versionNumber").asInt(),
                        "检入应创建 v2"),
                () -> assertEquals("PUBLISHED", data.path("status").asText(),
                        "新版本状态应为 PUBLISHED"),
                () -> assertEquals("检入发布版本", data.path("comment").asText()),
                () -> assertEquals("c".repeat(64), data.path("checksum").asText()),
                () -> assertNotNull(data.path("id").asText())
        );
    }

    /**
     * 应该拒绝未检出文档的检入
     *
     * <p>文档处于 DRAFT（未检出）状态时检入应返回 422 + DOCUMENT_NOT_CHECKED_OUT（4239）。
     */
    @Test
    @DisplayName("应该拒绝未检出文档的检入（422 + 4239）")
    void shouldRejectCheckinWhenNotCheckedOut() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-nco-tenant-" + UUID.randomUUID());
        String email = "cde-nco+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId);

        // 不检出直接检入
        String checkinBody = """
                {"comment":"未检出即检入","storageKey":"s3://v2","checksum":"%s","sizeBytes":100}
                """.formatted("d".repeat(64));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkin", HttpMethod.POST,
                new HttpEntity<>(checkinBody, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4239, extractCode(resp.getBody()),
                        "业务码应为 DOCUMENT_NOT_CHECKED_OUT（4239）")
        );
    }

    /**
     * 应该完成完整生命周期：create → checkout → checkin → 验证 PUBLISHED 与版本链
     *
     * <p>完整流程后：
     * <ul>
     *   <li>文档状态为 PUBLISHED</li>
     *   <li>currentVersionId 指向 v2</li>
     *   <li>版本列表含 2 个版本：v2=PUBLISHED，v1=SUPERSEDED</li>
     * </ul>
     */
    @Test
    @DisplayName("应该完成完整生命周期并验证版本链")
    void shouldCompleteFullLifecycle() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-life-tenant-" + UUID.randomUUID());
        String email = "cde-life+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId);

        // Act（执行）—— checkout → checkin
        restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkout", HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);
        String checkinBody = """
                {"comment":"生命周期发布","storageKey":"s3://life/v2","checksum":"%s","sizeBytes":4096}
                """.formatted("e".repeat(64));
        ResponseEntity<String> checkinResp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkin", HttpMethod.POST,
                new HttpEntity<>(checkinBody, withAccessToken(tenantId, accessToken)), String.class);
        UUID v2Id = UUID.fromString(extractData(checkinResp.getBody()).path("id").asText());

        // 查询文档详情
        ResponseEntity<String> docResp = restTemplate.exchange(
                "/api/v1/documents/" + documentId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // 查询版本列表
        ResponseEntity<String> versionsResp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/versions", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode doc = extractData(docResp.getBody());
        JsonNode versions = extractData(versionsResp.getBody());
        assertAll(
                () -> assertEquals("PUBLISHED", doc.path("status").asText(),
                        "文档最终状态应为 PUBLISHED"),
                () -> assertEquals(v2Id.toString(), doc.path("currentVersionId").asText(),
                        "currentVersionId 应指向 v2"),
                () -> assertEquals("e".repeat(64), doc.path("checksum").asText(),
                        "文档 checksum 应为 v2 的 checksum"),
                () -> assertTrue(versions.isArray() && versions.size() == 2,
                        "应有 2 个版本"),
                () -> assertEquals(2, versions.get(0).path("versionNumber").asInt(),
                        "首个版本应为 v2（降序）"),
                () -> assertEquals("PUBLISHED", versions.get(0).path("status").asText(),
                        "v2 状态应为 PUBLISHED"),
                () -> assertEquals(1, versions.get(1).path("versionNumber").asInt(),
                        "第二个版本应为 v1"),
                () -> assertEquals("SUPERSEDED", versions.get(1).path("status").asText(),
                        "v1 应被标记为 SUPERSEDED")
        );
    }

    // ── 内部辅助方法 ──

    /**
     * 通过 API 创建项目并返回项目 ID
     */
    private UUID createProject(UUID tenantId, String accessToken) throws Exception {
        String projectCode = "CDE-CO-" + UUID.randomUUID().toString().substring(0, 8);
        String body = """
                {"name":"检出测试项目","code":"%s"}
                """.formatted(projectCode);
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建项目失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

    /**
     * 通过 API 创建文档并返回文档 ID
     */
    private UUID createDocument(UUID tenantId, String accessToken, UUID projectId) throws Exception {
        String body = """
                {"name":"检出测试.dwg","path":"/test/co.dwg","mimeType":"application/acad","sizeBytes":512,"storageKey":"s3://co/v1","checksum":"%s","comment":"初始版本"}
                """.formatted(TEST_CHECKSUM);
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId + "/documents", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建文档失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }
}
