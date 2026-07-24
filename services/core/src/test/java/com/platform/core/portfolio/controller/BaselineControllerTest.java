package com.platform.core.portfolio.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import com.platform.core.portfolio.dto.FreezeBaselineRequest;
import com.platform.core.portfolio.dto.ProjectBaselineDto;
import com.platform.core.portfolio.service.BaselineService;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 项目基线控制器单元测试
 *
 * 覆盖：冻结基线、列表查询。
 */
@ExtendWith(MockitoExtension.class)
class BaselineControllerTest {

    @Mock
    private BaselineService baselineService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private HttpServletRequest httpRequest;

    private BaselineController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID baselineId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new BaselineController(baselineService, tenantResolver);
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
    }

    @Test
    @DisplayName("POST 冻结基线应该返回 201 状态码")
    void freezeShouldReturn201() {
        // Arrange
        FreezeBaselineRequest request = new FreezeBaselineRequest(
                "v1.0-方案基线", "方案设计阶段冻结基线", Map.of());
        ProjectBaselineDto dto = buildBaselineDto();
        when(baselineService.freezeBaseline(eq(tenantId), eq(projectId), eq(request))).thenReturn(dto);

        // Act
        ResponseEntity<ApiResponse<ProjectBaselineDto>> response =
                controller.freeze(projectId, request, httpRequest);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().data().id()).isEqualTo(baselineId);
        verify(baselineService).freezeBaseline(eq(tenantId), eq(projectId), eq(request));
    }

    @Test
    @DisplayName("GET 应该返回项目基线列表")
    void listShouldReturnBaselineList() {
        // Arrange
        ProjectBaselineDto dto = buildBaselineDto();
        when(baselineService.listBaselines(eq(tenantId), eq(projectId))).thenReturn(List.of(dto));

        // Act
        ApiResponse<List<ProjectBaselineDto>> response = controller.list(projectId, httpRequest);

        // Assert
        assertThat(response.data()).hasSize(1);
        verify(baselineService).listBaselines(eq(tenantId), eq(projectId));
    }

    private ProjectBaselineDto buildBaselineDto() {
        Instant now = Instant.now();
        return new ProjectBaselineDto(
                baselineId, tenantId, projectId, 1L,
                "v1.0-方案基线", "PUBLISHED", now, userId,
                "方案设计阶段冻结基线", "L3", "{}",
                now, now, 1L
        );
    }
}
