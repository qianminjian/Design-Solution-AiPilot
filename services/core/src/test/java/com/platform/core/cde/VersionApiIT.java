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
 * 文档版本（DocumentVersion）API 集成测试
 *
 * <p>覆盖版本上传、列表查询、详情查询、自动递增 versionNumber、旧版本 SUPERSEDED 标记等业务规则：
 * <ul>
 *   <li>POST /api/v1/documents/{id}/versions —— 上传新版本</li>
 *   <li>GET  /api/v1/documents/{id}/versions —— 版本列表（降序）</li>
 *   <li>GET  /api/v1/documents/{id}/versions/{versionId} —— 版本详情</li>
 * </ul>
 */
@DisplayName("文档版本（DocumentVersion）API 集成测试")
class VersionApiIT extends AbstractIntegrationTest {

    /** 项目端点 */
    private static final String PROJECTS_URL = "/api/v1/projects";
    /** 64 位 SHA-256 测试校验和（全 a） */
    private static final String TEST_CHECKSUM = "a".repeat(64);

    /**
     * 应该上传新版本并自动递增 versionNumber
     *
     * <p>创建文档时自动生成 v1（DRAFT）；
     * 上传新版本后 v1 状态转为 SUPERSEDED，新版本为 v2（DRAFT）。
     */
    @Test
    @DisplayName("应该上传新版本并自动递增 versionNumber")
    void shouldUploadNewVersionWithAutoIncrement() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-ver-tenant-" + UUID.randomUUID());
        String email = "cde-ver+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId);

        String uploadBody = """
                {"storageKey":"s3://bucket/v2.dwg","checksum":"%s","comment":"第二版","sizeBytes":2048,"mimeType":"application/acad"}
                """.formatted("b".repeat(64));

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/versions", HttpMethod.POST,
                new HttpEntity<>(uploadBody, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.CREATED, resp.getStatusCode()),
                () -> assertEquals(0, extractCode(resp.getBody())),
                () -> assertEquals(2, data.path("versionNumber").asInt(),
                        "新版本号应为 2"),
                () -> assertEquals("DRAFT", data.path("status").asText(),
                        "uploadVersion 创建的版本状态为 DRAFT"),
                () -> assertEquals("第二版", data.path("comment").asText()),
                () -> assertEquals("b".repeat(64), data.path("checksum").asText())
        );
    }

    /**
     * 应该在上传新版本后将旧版本标记为 SUPERSEDED
     */
    @Test
    @DisplayName("应该在上传新版本后将旧版本标记为 SUPERSEDED")
    void shouldMarkOldVersionAsSuperseded() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-sup-tenant-" + UUID.randomUUID());
        String email = "cde-sup+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId);

        // 获取初始版本 v1
        ResponseEntity<String> listResp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/versions", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);
        UUID v1Id = UUID.fromString(extractData(listResp.getBody()).get(0).path("id").asText());

        // 上传 v2
        String uploadBody = """
                {"storageKey":"s3://bucket/v2.dwg","checksum":"%s","comment":"v2","sizeBytes":2048}
                """.formatted("c".repeat(64));
        restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/versions", HttpMethod.POST,
                new HttpEntity<>(uploadBody, withAccessToken(tenantId, accessToken)), String.class);

        // Act（执行）—— 查询 v1 详情，状态应为 SUPERSEDED
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/versions/" + v1Id, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals("SUPERSEDED", data.path("status").asText(),
                        "旧版本应被标记为 SUPERSEDED"),
                () -> assertEquals(1, data.path("versionNumber").asInt())
        );
    }

    /**
     * 应该按 versionNumber 降序列出所有版本
     */
    @Test
    @DisplayName("应该按 versionNumber 降序列出所有版本")
    void shouldListVersionsDescending() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-lv-tenant-" + UUID.randomUUID());
        String email = "cde-lv+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId);

        // 上传 v2 和 v3
        uploadVersion(accessToken, tenantId, documentId, "d".repeat(64), "v2");
        uploadVersion(accessToken, tenantId, documentId, "e".repeat(64), "v3");

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/versions", HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertTrue(data.isArray(), "版本列表应为数组"),
                () -> assertEquals(3, data.size(), "应有 3 个版本"),
                () -> assertEquals(3, data.get(0).path("versionNumber").asInt(),
                        "首个版本号应为 3（降序）"),
                () -> assertEquals(2, data.get(1).path("versionNumber").asInt()),
                () -> assertEquals(1, data.get(2).path("versionNumber").asInt())
        );
    }

    /**
     * 应该按 ID 查询版本详情
     */
    @Test
    @DisplayName("应该按 ID 查询版本详情")
    void shouldGetVersionById() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-gv-tenant-" + UUID.randomUUID());
        String email = "cde-gv+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId);

        // 上传 v2
        String uploadBody = """
                {"storageKey":"s3://v2","checksum":"%s","comment":"查询测试","sizeBytes":100}
                """.formatted("f".repeat(64));
        ResponseEntity<String> uploadResp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/versions", HttpMethod.POST,
                new HttpEntity<>(uploadBody, withAccessToken(tenantId, accessToken)), String.class);
        UUID versionId = UUID.fromString(extractData(uploadResp.getBody()).path("id").asText());

        // Act（执行）
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/versions/" + versionId, HttpMethod.GET,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        JsonNode data = extractData(resp.getBody());
        assertAll(
                () -> assertEquals(HttpStatus.OK, resp.getStatusCode()),
                () -> assertEquals(versionId.toString(), data.path("id").asText()),
                () -> assertEquals(2, data.path("versionNumber").asInt()),
                () -> assertEquals("查询测试", data.path("comment").asText()),
                () -> assertEquals("DRAFT", data.path("status").asText())
        );
    }

    /**
     * 应该拒绝向已检出文档上传新版本
     *
     * <p>文档处于 CHECKED_OUT 状态时不可上传 DRAFT 版本（应使用 checkin）。
     */
    @Test
    @DisplayName("应该拒绝向已检出文档上传新版本（422）")
    void shouldRejectUploadToCheckedOutDocument() throws Exception {
        // Arrange（准备）
        UUID tenantId = createTestTenant("cde-co-tenant-" + UUID.randomUUID());
        String email = "cde-co+" + UUID.randomUUID() + "@example.com";
        createTestPrincipal(tenantId, email);
        String accessToken = loginAndGetAccessToken(tenantId, email);
        UUID projectId = createProject(tenantId, accessToken);
        UUID documentId = createDocument(tenantId, accessToken, projectId);

        // 先检出
        restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/checkout", HttpMethod.POST,
                new HttpEntity<>(withAccessToken(tenantId, accessToken)), String.class);

        // Act（执行）—— 检出状态下上传应失败
        String uploadBody = """
                {"storageKey":"s3://v2","checksum":"%s","comment":"v2","sizeBytes":100}
                """.formatted("1".repeat(64));
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/versions", HttpMethod.POST,
                new HttpEntity<>(uploadBody, withAccessToken(tenantId, accessToken)), String.class);

        // Assert（断言）
        assertAll(
                () -> assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, resp.getStatusCode()),
                () -> assertEquals(4238, extractCode(resp.getBody()),
                        "业务码应为 DOCUMENT_CHECKED_OUT（4238）")
        );
    }

    // ── 内部辅助方法 ──

    private UUID createProject(UUID tenantId, String accessToken) throws Exception {
        String projectCode = "CDE-V-" + UUID.randomUUID().toString().substring(0, 8);
        String body = """
                {"name":"版本测试项目","code":"%s"}
                """.formatted(projectCode);
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL, HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建项目失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

    private UUID createDocument(UUID tenantId, String accessToken, UUID projectId) throws Exception {
        String body = """
                {"name":"版本测试.dwg","path":"/test/ver.dwg","mimeType":"application/acad","sizeBytes":512,"storageKey":"s3://v1","checksum":"%s","comment":"初始版本"}
                """.formatted(TEST_CHECKSUM);
        ResponseEntity<String> resp = restTemplate.exchange(
                PROJECTS_URL + "/" + projectId + "/documents", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "创建文档失败: " + resp.getBody());
        return UUID.fromString(extractData(resp.getBody()).path("id").asText());
    }

    private void uploadVersion(String accessToken, UUID tenantId, UUID documentId,
                               String checksum, String comment) throws Exception {
        String body = """
                {"storageKey":"s3://%s","checksum":"%s","comment":"%s","sizeBytes":256}
                """.formatted(comment, checksum, comment);
        ResponseEntity<String> resp = restTemplate.exchange(
                "/api/v1/documents/" + documentId + "/versions", HttpMethod.POST,
                new HttpEntity<>(body, withAccessToken(tenantId, accessToken)), String.class);
        assertEquals(HttpStatus.CREATED, resp.getStatusCode(), "上传版本失败: " + resp.getBody());
    }
}
