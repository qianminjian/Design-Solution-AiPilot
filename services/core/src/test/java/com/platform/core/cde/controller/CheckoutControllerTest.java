package com.platform.core.cde.controller;

import com.platform.core.cde.dto.CheckinRequest;
import com.platform.core.cde.dto.CheckoutDto;
import com.platform.core.cde.dto.DocumentVersionDto;
import com.platform.core.cde.service.CheckoutService;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 检入检出控制器单元测试
 *
 * <p>覆盖点：
 * <ul>
 *   <li>检出文档：返回 200 与 CheckoutDto</li>
 *   <li>检入文档：返回 200 与新版本 DTO</li>
 *   <li>每次请求通过 TenantResolver 解析租户 ID</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class CheckoutControllerTest {

    @Mock
    private CheckoutService checkoutService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private CheckoutController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID documentId = UUID.randomUUID();
    private final UUID versionId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();

    /** 64 位 SHA-256 测试校验和（全 c） */
    private static final String TEST_CHECKSUM = "c".repeat(64);

    @BeforeEach
    void setUp() {
        controller = new CheckoutController(checkoutService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("检出文档应该返回 200 与 CheckoutDto")
    void checkoutShouldReturn200WithDto() {
        CheckoutDto dto = new CheckoutDto(
                documentId,
                "CHECKED_OUT",
                actorId,
                Instant.now()
        );
        when(checkoutService.checkout(tenantId, documentId)).thenReturn(dto);

        ApiResponse<CheckoutDto> response = controller.checkout(documentId, httpRequest);

        assertThat(response.code()).isZero();
        assertThat(response.data()).isNotNull();
        assertThat(response.data().documentId()).isEqualTo(documentId);
        assertThat(response.data().status()).isEqualTo("CHECKED_OUT");
        assertThat(response.data().checkedOutBy()).isEqualTo(actorId);
        verify(checkoutService).checkout(tenantId, documentId);
    }

    @Test
    @DisplayName("检入文档应该返回 200 与新版本 DTO")
    void checkinShouldReturn200WithNewVersion() {
        CheckinRequest request = new CheckinRequest(
                "检入发布",
                "s3://bucket/tenant1/project1/doc1/v2.dwg",
                TEST_CHECKSUM,
                2048L,
                "application/acad"
        );
        DocumentVersionDto versionDto = new DocumentVersionDto(
                versionId,
                documentId,
                2,
                actorId,
                Instant.now(),
                "检入发布",
                "s3://bucket/tenant1/project1/doc1/v2.dwg",
                TEST_CHECKSUM,
                "PUBLISHED"
        );
        when(checkoutService.checkin(eq(tenantId), eq(documentId), any(CheckinRequest.class)))
                .thenReturn(versionDto);

        ApiResponse<DocumentVersionDto> response = controller.checkin(documentId, request, httpRequest);

        assertThat(response.code()).isZero();
        assertThat(response.data()).isNotNull();
        assertThat(response.data().id()).isEqualTo(versionId);
        assertThat(response.data().versionNumber()).isEqualTo(2);
        assertThat(response.data().status()).isEqualTo("PUBLISHED");
        verify(checkoutService).checkin(eq(tenantId), eq(documentId), any(CheckinRequest.class));
    }

    @Test
    @DisplayName("每次请求都应该通过 TenantResolver 解析租户 ID")
    void shouldResolveTenantIdForEachRequest() {
        // checkout 一次
        when(checkoutService.checkout(tenantId, documentId))
                .thenReturn(new CheckoutDto(documentId, "CHECKED_OUT", actorId, Instant.now()));
        controller.checkout(documentId, httpRequest);

        // checkin 一次
        CheckinRequest req = new CheckinRequest("说明", "s3://k", TEST_CHECKSUM, 1L, null);
        when(checkoutService.checkin(eq(tenantId), eq(documentId), any(CheckinRequest.class)))
                .thenReturn(new DocumentVersionDto(
                        versionId, documentId, 2, actorId, Instant.now(),
                        "说明", "s3://k", TEST_CHECKSUM, "PUBLISHED"
                ));
        controller.checkin(documentId, req, httpRequest);

        verify(tenantResolver, org.mockito.Mockito.times(2)).resolveTenantId(httpRequest);
    }
}
