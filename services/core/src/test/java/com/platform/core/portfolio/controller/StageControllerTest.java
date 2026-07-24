package com.platform.core.portfolio.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.StageInstanceDto;
import com.platform.core.portfolio.dto.TransitionStageRequest;
import com.platform.core.portfolio.service.StageService;
import jakarta.servlet.http.HttpServletRequest;
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
 * 阶段控制器单元测试
 *
 * 覆盖：列表查询、阶段流转。
 */
@ExtendWith(MockitoExtension.class)
class StageControllerTest {

    @Mock
    private StageService stageService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private StageController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID stageId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new StageController(stageService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("GET 应该返回项目阶段列表")
    void listShouldReturnStageList() {
        // Arrange
        StageInstanceDto dto = buildStageDto();
        when(stageService.listStages(eq(tenantId), eq(projectId))).thenReturn(List.of(dto));

        // Act
        ApiResponse<List<StageInstanceDto>> response = controller.list(projectId, httpRequest);

        // Assert
        assertThat(response.data()).hasSize(1);
        verify(stageService).listStages(eq(tenantId), eq(projectId));
    }

    @Test
    @DisplayName("POST /{stageId}:transition 应该调用 Service 流转阶段")
    void transitionShouldInvokeService() {
        // Arrange
        TransitionStageRequest request = new TransitionStageRequest("IN_PROGRESS", "进入方案设计阶段");
        StageInstanceDto dto = buildStageDto();
        when(stageService.transitionStage(eq(tenantId), eq(projectId), eq(stageId), eq(request))).thenReturn(dto);

        // Act
        ApiResponse<StageInstanceDto> response = controller.transition(projectId, stageId, request, httpRequest);

        // Assert
        assertThat(response.data().id()).isEqualTo(stageId);
        verify(stageService).transitionStage(eq(tenantId), eq(projectId), eq(stageId), eq(request));
    }

    private StageInstanceDto buildStageDto() {
        Instant now = Instant.now();
        return new StageInstanceDto(
                stageId, tenantId, projectId, "SCHEME", "方案设计",
                2, "IN_PROGRESS", now, null, "L3", "{}",
                now, now, 1L
        );
    }
}
