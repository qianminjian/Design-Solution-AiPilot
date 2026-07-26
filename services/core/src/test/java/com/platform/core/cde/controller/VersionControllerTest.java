package com.platform.core.cde.controller;

import com.platform.core.cde.dto.DocumentVersionDto;
import com.platform.core.cde.dto.UploadVersionRequest;
import com.platform.core.cde.service.VersionService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 文档版本控制器单元测试
 *
 * <p>覆盖点：
 * <ul>
 *   <li>上传新版本：返回 201 与版本 DTO</li>
 *   <li>查询文档所有版本：返回 200 与列表</li>
 *   <li>查询单个版本详情：返回 200 与 DTO</li>
 *   <li>每次请求通过 TenantResolver 解析租户 ID</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class VersionControllerTest {

    @Mock
    private VersionService versionService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private VersionController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID documentId = UUID.randomUUID();
    private final UUID versionId = UUID.randomUUID();
    private final UUID uploadedBy = UUID.randomUUID();

    /** 64 位 SHA-256 测试校验和（全 b） */
    private static final String TEST_CHECKSUM = "b".repeat(64);

    @BeforeEach
    void setUp() {
        controller = new VersionController(versionService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("上传新版本应该返回 201 状态码与版本 DTO")
    void uploadShouldReturn201WithVersion() {
        UploadVersionRequest request = new UploadVersionRequest(
                "s3://bucket/tenant1/project1/doc1/v2.dwg",
                TEST_CHECKSUM,
                "第二版",
                2048L,
                "application/acad"
        );
        DocumentVersionDto dto = buildVersionDto(2);
        when(versionService.uploadVersion(eq(tenantId), eq(documentId), any(UploadVersionRequest.class)))
                .thenReturn(dto);

        ResponseEntity<ApiResponse<DocumentVersionDto>> response =
                controller.upload(documentId, request, httpRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isZero();
        assertThat(response.getBody().data()).isNotNull();
        assertThat(response.getBody().data().id()).isEqualTo(versionId);
        assertThat(response.getBody().data().versionNumber()).isEqualTo(2);
        assertThat(response.getBody().data().checksum()).isEqualTo(TEST_CHECKSUM);
        verify(versionService).uploadVersion(eq(tenantId), eq(documentId), any(UploadVersionRequest.class));
    }

    @Test
    @DisplayName("查询文档所有版本应该返回版本列表")
    void listShouldReturnAllVersions() {
        List<DocumentVersionDto> versions = Arrays.asList(
                buildVersionDto(3),
                buildVersionDto(2),
                buildVersionDto(1)
        );
        when(versionService.listVersions(tenantId, documentId)).thenReturn(versions);

        ApiResponse<List<DocumentVersionDto>> response = controller.list(documentId, httpRequest);

        assertThat(response.code()).isZero();
        assertThat(response.data()).hasSize(3);
        assertThat(response.data().get(0).versionNumber()).isEqualTo(3);
        assertThat(response.data().get(2).versionNumber()).isEqualTo(1);
        verify(versionService).listVersions(tenantId, documentId);
    }

    @Test
    @DisplayName("查询文档版本列表为空时应该返回空列表")
    void listShouldReturnEmptyListWhenNoVersions() {
        when(versionService.listVersions(tenantId, documentId))
                .thenReturn(List.of());

        ApiResponse<List<DocumentVersionDto>> response = controller.list(documentId, httpRequest);

        assertThat(response.code()).isZero();
        assertThat(response.data()).isEmpty();
    }

    @Test
    @DisplayName("查询单个版本详情应该返回正确的版本")
    void getShouldReturnVersion() {
        DocumentVersionDto dto = buildVersionDto(2);
        when(versionService.getVersion(tenantId, documentId, versionId)).thenReturn(dto);

        ApiResponse<DocumentVersionDto> response = controller.get(documentId, versionId, httpRequest);

        assertThat(response.code()).isZero();
        assertThat(response.data()).isNotNull();
        assertThat(response.data().id()).isEqualTo(versionId);
        assertThat(response.data().versionNumber()).isEqualTo(2);
        verify(versionService).getVersion(tenantId, documentId, versionId);
    }

    @Test
    @DisplayName("每次请求都应该通过 TenantResolver 解析租户 ID")
    void shouldResolveTenantIdForEachRequest() {
        // upload 一次
        UploadVersionRequest req = new UploadVersionRequest(
                "s3://k", TEST_CHECKSUM, null, 1L, null
        );
        when(versionService.uploadVersion(eq(tenantId), eq(documentId), any(UploadVersionRequest.class)))
                .thenReturn(buildVersionDto(1));
        controller.upload(documentId, req, httpRequest);

        // list 一次
        when(versionService.listVersions(tenantId, documentId)).thenReturn(List.of());
        controller.list(documentId, httpRequest);

        // get 一次
        when(versionService.getVersion(tenantId, documentId, versionId)).thenReturn(buildVersionDto(1));
        controller.get(documentId, versionId, httpRequest);

        verify(tenantResolver, org.mockito.Mockito.times(3)).resolveTenantId(httpRequest);
    }

    private DocumentVersionDto buildVersionDto(int versionNumber) {
        return new DocumentVersionDto(
                versionId,
                documentId,
                versionNumber,
                uploadedBy,
                Instant.now(),
                "版本 v" + versionNumber,
                "s3://bucket/tenant1/project1/doc1/v" + versionNumber + ".dwg",
                TEST_CHECKSUM,
                "DRAFT"
        );
    }
}
