package com.platform.core.tevv.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.tevv.domain.VerificationStatus;
import com.platform.core.tevv.domain.VerificationType;
import com.platform.core.tevv.dto.CreateVerificationItemRequest;
import com.platform.core.tevv.dto.VerificationItemDto;
import com.platform.core.tevv.service.VerificationItemService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 验证项控制器单元测试
 *
 * 覆盖：创建、按数据集查询、状态更新（含 waiver 原因）。
 */
@ExtendWith(MockitoExtension.class)
class VerificationItemControllerTest {

    @Mock
    private VerificationItemService itemService;

    private VerificationItemController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID itemId = UUID.randomUUID();
    private final UUID datasetId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new VerificationItemController(itemService);
    }

    @Test
    @DisplayName("POST 创建验证项应该调用 Service 并返回成功响应")
    void createShouldInvokeService() {
        // Arrange
        CreateVerificationItemRequest request = new CreateVerificationItemRequest(
                datasetId, "V-001", "功能布局验证",
                "验证办公建筑功能布局合理性", (short) 1,
                VerificationType.AUTOMATED, "MEDIUM");
        VerificationItemDto dto = buildDto();
        when(itemService.create(eq(tenantId), eq(request), eq(userId))).thenReturn(dto);

        // Act
        ApiResponse<VerificationItemDto> response = controller.create(tenantId, request, userId);

        // Assert
        assertThat(response.code()).isZero();
        assertThat(response.data().id()).isEqualTo(itemId);
        verify(itemService).create(eq(tenantId), eq(request), eq(userId));
    }

    @Test
    @DisplayName("GET 应该返回数据集下验证项列表")
    void listByDatasetShouldReturnItems() {
        // Arrange
        VerificationItemDto dto = buildDto();
        when(itemService.listByDataset(eq(tenantId), eq(datasetId))).thenReturn(List.of(dto));

        // Act
        ApiResponse<List<VerificationItemDto>> response = controller.listByDataset(tenantId, datasetId);

        // Assert
        assertThat(response.data()).hasSize(1);
        verify(itemService).listByDataset(eq(tenantId), eq(datasetId));
    }

    @Test
    @DisplayName("PATCH /{itemId}/status 应该调用 Service 更新验证项状态")
    void updateStatusShouldInvokeService() {
        // Arrange
        VerificationItemDto dto = buildDto();
        when(itemService.updateStatus(eq(tenantId), eq(itemId), eq(VerificationStatus.PASSED),
                eq(userId), eq(null))).thenReturn(dto);

        // Act
        ApiResponse<VerificationItemDto> response =
                controller.updateStatus(tenantId, itemId, VerificationStatus.PASSED, null, userId);

        // Assert
        assertThat(response.data().id()).isEqualTo(itemId);
        verify(itemService).updateStatus(eq(tenantId), eq(itemId), eq(VerificationStatus.PASSED),
                eq(userId), eq(null));
    }

    @Test
    @DisplayName("PATCH /{itemId}/status 带 waiverReason 应该调用 Service 更新为 WAIVED 状态")
    void updateStatusWithWaiverShouldInvokeService() {
        // Arrange
        VerificationItemDto dto = buildDto();
        when(itemService.updateStatus(eq(tenantId), eq(itemId), eq(VerificationStatus.WAIVED),
                eq(userId), eq("风险已通过专家评审豁免"))).thenReturn(dto);

        // Act
        ApiResponse<VerificationItemDto> response = controller.updateStatus(
                tenantId, itemId, VerificationStatus.WAIVED, "风险已通过专家评审豁免", userId);

        // Assert
        assertThat(response.data().id()).isEqualTo(itemId);
        verify(itemService).updateStatus(eq(tenantId), eq(itemId), eq(VerificationStatus.WAIVED),
                eq(userId), eq("风险已通过专家评审豁免"));
    }

    private VerificationItemDto buildDto() {
        return new VerificationItemDto(
                itemId, datasetId, "V-001", "功能布局验证",
                "验证办公建筑功能布局合理性", (short) 1,
                VerificationType.AUTOMATED, "MEDIUM", VerificationStatus.PENDING,
                "[]", userId, Instant.now(), null
        );
    }
}
