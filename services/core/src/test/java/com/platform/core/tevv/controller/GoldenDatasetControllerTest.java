package com.platform.core.tevv.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.tevv.domain.DatasetCategory;
import com.platform.core.tevv.domain.DatasetStatus;
import com.platform.core.tevv.dto.CreateDatasetRequest;
import com.platform.core.tevv.dto.GoldenDatasetDto;
import com.platform.core.tevv.service.GoldenDatasetService;
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
 * 金样数据集控制器单元测试
 *
 * 覆盖：创建、列表、冻结。
 */
@ExtendWith(MockitoExtension.class)
class GoldenDatasetControllerTest {

    @Mock
    private GoldenDatasetService datasetService;

    private GoldenDatasetController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID datasetId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new GoldenDatasetController(datasetService);
    }

    @Test
    @DisplayName("POST 创建数据集应该调用 Service 并返回成功响应")
    void createShouldInvokeService() {
        // Arrange
        CreateDatasetRequest request = new CreateDatasetRequest(
                "办公建筑方案集", "中小型办公建筑方案数据集",
                DatasetCategory.ARCHITECTURE, "OFFICE", "s3://bucket/dataset-001");
        GoldenDatasetDto dto = buildDto();
        when(datasetService.create(eq(tenantId), eq(request), eq(userId))).thenReturn(dto);

        // Act
        ApiResponse<GoldenDatasetDto> response = controller.create(tenantId, request, userId);

        // Assert
        assertThat(response.code()).isZero();
        assertThat(response.data().id()).isEqualTo(datasetId);
        verify(datasetService).create(eq(tenantId), eq(request), eq(userId));
    }

    @Test
    @DisplayName("GET 应该返回租户下数据集列表")
    void listShouldReturnDatasetList() {
        // Arrange
        GoldenDatasetDto dto = buildDto();
        when(datasetService.listByTenant(eq(tenantId))).thenReturn(List.of(dto));

        // Act
        ApiResponse<List<GoldenDatasetDto>> response = controller.list(tenantId);

        // Assert
        assertThat(response.data()).hasSize(1);
        verify(datasetService).listByTenant(eq(tenantId));
    }

    @Test
    @DisplayName("POST /{datasetId}/freeze 应该调用 Service 冻结数据集")
    void freezeShouldInvokeService() {
        // Arrange
        GoldenDatasetDto dto = buildDto();
        when(datasetService.freeze(eq(tenantId), eq(datasetId), eq(userId))).thenReturn(dto);

        // Act
        ApiResponse<GoldenDatasetDto> response = controller.freeze(tenantId, datasetId, userId);

        // Assert
        assertThat(response.data().id()).isEqualTo(datasetId);
        verify(datasetService).freeze(eq(tenantId), eq(datasetId), eq(userId));
    }

    private GoldenDatasetDto buildDto() {
        return new GoldenDatasetDto(
                datasetId, "办公建筑方案集", "中小型办公建筑方案数据集",
                DatasetCategory.ARCHITECTURE, "OFFICE", DatasetStatus.DRAFT,
                "v1.0", "s3://bucket/dataset-001", 5, 1024L,
                null, null, Instant.now(), userId
        );
    }
}
