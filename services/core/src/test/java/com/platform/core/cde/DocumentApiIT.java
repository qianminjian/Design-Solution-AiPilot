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
 * 文档（Document）API 集成测试
 *
 * <p>覆盖文档 CRUD、软删除、项目作用域隔离等业务规则：
 * <ul>
 *   <li>POST   /api/v1/projects/{projectId}/documents —— 创建文档（含初始版本 v1）</li>
 *   <li>GET    /api/v1/projects/{projectId}/documents —— 分页查询</li>
 *   <li>GET    /api/v1/documents/{id} —— 查询详情</li>
 *   <li>PATCH  /api/v1/documents/{id} —— 更新元数据</li>
 *   <li>DELETE /api/v1/documents/{id} —— 软删除（仅 DRAFT 可删）</li>
 * </ul>
 */
@DisplayName("文档（Document）API 集成测试")
class DocumentApiIT extends AbstractIntegrationTest {

    /** 项目端点 */
    private static final String PROJECTS_URL = "/api/v1/projects";
    /** 64 位 SHA-256 测试校验和（全 a） */
    private static final String TEST_CHECKSUM = "a".repeat(64);

    /**
     * 应该成功创建文档并自动创建初始版本 v1
     */
    @Test
    @DisplayName("应该成功创建文档并自动创建初始版本 v1")
    void shouldCreateDocumentSuccessfully() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-doc-tenant-" + UUID.randomUUID());
        String email = "cde-doc+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);

        String body = """
                {"name":"方案设计图.dwg","path":"/project-1/drawings/scheme.dwg","mimeType":"application/acad","sizeBytes":1024,"storageKey":"s3://bucket/tenant1/project1/doc1/v1.dwg","checksum":"%s","comment":"初始版本"}
                """.formatted(TEST_CHECKSUM);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId + "/documents", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals("方案设计图.dwg", data.path("name").asText()),
                () -> assertEquals("DRAFT", data.path("status").asText()),
                () -> assertEquals("application/acad", data.path("mimeType").asText()),
                () -> assertEquals(1024, data.path("sizeBytes").asInt()),
                () -> assertEquals(TEST_CHECKSUM, data.path("checksum").asText()),
                () -> assertNotNull(data.path("currentVersionId").asText(),
                        "创建后应自动生成初始版本"),
                () -> assertNotNull(data.path("id").asText())
        );
    }

    /**
     * 应该拒绝为不存在的项目创建文档
     */
    @Test
    @DisplayName("应该拒绝为不存在的项目创建文档（422）")
    void shouldRejectCreateWithNonExistentProject() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-np-tenant-" + UUID.randomUUID());
        String email = "cde-np+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID fakeProjectId = UUID.randomUUID();

        String body = """
                {"name":"测试文档","path":"/test.doc","mimeType":"text/plain","storageKey":"s3://k","checksum":"%s"}
                """.formatted(TEST_CHECKSUM);

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "/" + fakeProjectId + "/documents", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4227, extractCode(resp.getBody()),
                        "业务码应为 PROJECT_NOT_FOUND（4227）")
        );
    }

    /**
     * 应该按 ID 查询文档
     */
    @Test
    @DisplayName("应该按 ID 查询文档")
    void shouldGetDocumentById() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-get-tenant-" + UUID.randomUUID());
        String email = "cde-get+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId, "查询测试.dwg");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(documentId.toString(), data.path("id").asText()),
                () -> assertEquals("查询测试.dwg", data.path("name").asText()),
                () -> assertEquals(projectId.toString(), data.path("projectId").asText())
        );
    }

    /**
     * 应该分页查询项目下文档
     */
    @Test
    @DisplayName("应该分页查询项目下文档")
    void shouldListDocumentsByProject() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-list-tenant-" + UUID.randomUUID());
        String email = "cde-list+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        createDocument(tenantId, accessToken, projectId, "文档一.dwg");
        createDocument(tenantId, accessToken, projectId, "文档二.dwg");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId + "/documents?page=1&pageSize=10", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(1, data.path("page").asInt()),
                () -> assertEquals(10, data.path("pageSize").asInt()),
                () -> assertTrue(data.path("total").asLong() >= 2),
                () -> assertTrue(data.path("list").isArray()),
                () -> assertTrue(data.path("list").size() >= 2)
        );
    }

    /**
     * 应该更新文档元数据
     */
    @Test
    @DisplayName("应该更新文档名称与路径")
    void shouldUpdateDocument() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-upd-tenant-" + UUID.randomUUID());
        String email = "cde-upd+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId, "原名.dwg");

        String updateBody = """
                {"name":"新名称.dwg","path":"/updated/path.dwg"}
                """;

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId, HttpMethod.PATCH,
                new HttpEntity<>(updateBody, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("新名称.dwg", data.path("name").asText()),
                () -> assertEquals("/updated/path.dwg", data.path("path").asText())
        );
    }

    /**
     * 应该软删除 DRAFT 状态文档
     */
    @Test
    @DisplayName("应该软删除 DRAFT 状态文档")
    void shouldDeleteDraftDocument() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-del-tenant-" + UUID.randomUUID());
        String email = "cde-del+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId, "待删除.dwg");

        // Act（执行）
        ResponseEntity<String> deleteResp = restTemplate.exchange(
                "/api/v1/documents/" + documentId, HttpMethod.DELETE,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）—— 删除后再查询应返回 404
        ResponseEntity<String> getResp = restTemplate.exchange(
                "/api/v1/documents/" + documentId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        assertAll(
                () -> assertEquals(HttpStatus.OK, deleteResp.getStatusCode()),
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, getResp.getStatusCode(),
                        "软删除后查询应返回 DOCUMENT_NOT_FOUND"),
                () -> assertEquals(4236, extractCode(getResp.getBody()),
                        "业务码应为 DOCUMENT_NOT_FOUND（4236）")
        );
    }

    /**
     * 应该拒绝删除 PUBLISHED 状态文档（须先归档）
     */
    @Test
    @DisplayName("应该拒绝删除 PUBLISHED 状态文档（422）")
    void shouldRejectDeletePublishedDocument() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-delp-tenant-" + UUID.randomUUID());
        String email = "cde-delp+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId, "已发布.dwg");

        // 先检出再检入，使文档状态变为 PUBLISHED
        restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkout", HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);
        String checkinBody = """
                {"comment":"检入发布","storageKey":"s3://v2","checksum":"%s","sizeBytes":2048}
                """.formatted("b".repeat(64));
        restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkin", HttpMethod.POST,
                new HttpEntity<>(checkinBody, withAccessToken(tenantId, accessToken)), String.class);

        // Act（执行）—— 删除 PUBLISHED 文档应失败
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId, HttpMethod.DELETE,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4240, extractCode(resp.getBody()),
                        "业务码应为 INVALID_DOCUMENT_STATUS（4240）")
        );
    }

    // ── 内部辅助方法 ──

    /**
     * 通过 API 创建项目并返回项目 ID
     */
    private UUID createProject(UUID tenantId, String accessToken) throws Exception {
        String projectCode = "CDE-" + UUID.randomUUID().toString().substring(0, 8);
        String body = """
                {"name":"CDE 测试项目","code":"%s"}
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
    private UUID createDocument(UUID tenantId, String accessToken, UUID projectId,
                                String documentName) throws Exception {
        String body = """
                {"name":"%s","path":"/test/%s.dwg","mimeType":"application/acad","sizeBytes":512,"storageKey":"s3://bucket/%s","checksum":"%s","comment":"初始版本"}
                """.formatted(documentName, documentName, documentName, TEST_CHECKSUM);
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId + "/documents", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建文档失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }
}
