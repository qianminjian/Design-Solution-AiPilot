package com.platform.core.compliance.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.compliance.dto.ComplianceFindingDto;
import com.platform.core.compliance.dto.CreateFindingRequest;
import com.platform.core.compliance.dto.FindingCommandRequest;
import com.platform.core.compliance.service.FindingService;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 合规发现控制器单元测试（D45.25 Finding API，SIT P0-13.1）
 *
 * 覆盖：详情查询、分页查询、更新（指派/备注）、创建、独立复测、发布规则阻断判定。
 */
@ExtendWith(MockitoExtension.class)
class FindingControllerTest {

    @Mock
    private FindingService findingService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private FindingController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID findingId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new FindingController(findingService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("GET /{id} 应该返回发现详情")
    void getShouldReturnFindingDetail() {
        // Arrange
        ComplianceFindingDto dto = buildFindingDto();
        when(findingService.getFinding(eq(tenantId), eq(findingId))).thenReturn(dto);

        // Act
        ApiResponse<ComplianceFindingDto> response = controller.get(findingId, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(findingId);
        verify(findingService).getFinding(eq(tenantId), eq(findingId));
    }

    @Test
    @DisplayName("GET 分页查询应该返回 PageResponse")
    void listShouldReturnPageResponse() {
        // Arrange
        ComplianceFindingDto dto = buildFindingDto();
        Page<ComplianceFindingDto> page = new PageImpl<>(List.of(dto));
        when(findingService.listFindings(eq(tenantId), eq("HIGH"), eq("OPEN"), eq(userId), any(Pageable.class)))
                .thenReturn(page);

        // Act
        PageResponse<ComplianceFindingDto> response =
                controller.list(1, 20, "HIGH", "OPEN", userId, "desc", httpRequest);

        // Assert
        assertThat(response.data().list()).hasSize(1);
        verify(findingService).listFindings(eq(tenantId), eq("HIGH"), eq("OPEN"), eq(userId), any(Pageable.class));
    }

    @Test
    @DisplayName("PATCH /{id} 应该调用 Service 更新发现")
    void updateShouldInvokeService() {
        // Arrange
        FindingCommandRequest request = command("ASSIGN", userId, "指派给张三处理");
        ComplianceFindingDto dto = buildFindingDto();
        when(findingService.updateFinding(eq(tenantId), eq(findingId), eq(request))).thenReturn(dto);

        // Act
        ApiResponse<ComplianceFindingDto> response = controller.update(findingId, request, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(findingId);
        verify(findingService).updateFinding(eq(tenantId), eq(findingId), eq(request));
    }

    @Test
    @DisplayName("POST / 应该调用 Service 创建发现")
    void createShouldInvokeService() {
        // Arrange
        CreateFindingRequest request = new CreateFindingRequest(
                "HIGH", "SAFETY", "疏散通道宽度不足", null, null, null, null, null, null, null);
        ComplianceFindingDto dto = buildFindingDto();
        when(findingService.create(eq(tenantId), eq(request))).thenReturn(dto);

        // Act
        ApiResponse<ComplianceFindingDto> response = controller.create(request, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(findingId);
        verify(findingService).create(eq(tenantId), eq(request));
    }

    @Test
    @DisplayName("POST /{id}:retest 应该调用 Service 独立复测")
    void retestShouldInvokeService() {
        // Arrange
        FindingCommandRequest request = command("RETEST", null, null);
        ComplianceFindingDto dto = buildFindingDto();
        when(findingService.retest(eq(tenantId), eq(findingId), eq(request))).thenReturn(dto);

        // Act
        ApiResponse<ComplianceFindingDto> response = controller.retest(findingId, request, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(findingId);
        verify(findingService).retest(eq(tenantId), eq(findingId), eq(request));
    }

    @Test
    @DisplayName("GET /release-blocked 应该返回发布阻断判定")
    void releaseBlockedShouldReturnDecision() {
        // Arrange
        when(findingService.isReleaseBlocked(tenantId)).thenReturn(true);

        // Act
        ApiResponse<Map<String, Boolean>> response = controller.releaseBlocked(httpRequest);

        // Assert
        assertThat(response.data().get("blocked")).isTrue();
        verify(findingService).isReleaseBlocked(tenantId);
    }

    /** 构造简化命令请求（仅 command/assignedTo/note） */
    private FindingCommandRequest command(String cmd, UUID assignee, String note) {
        return new FindingCommandRequest(cmd, assignee, note, null, null, null, null, null,
                null, null, null, null, null, null);
    }

    private ComplianceFindingDto buildFindingDto() {
        Instant now = Instant.now();
        return new ComplianceFindingDto(
                findingId, tenantId, UUID.randomUUID(),
                "HIGH", "OPEN", userId, "发现违规项",
                "SAFETY", null, null, null, "IDENTIFIED", null, null,
                null, null, null, null,
                now, now, userId, userId, 1L
        );
    }
}
