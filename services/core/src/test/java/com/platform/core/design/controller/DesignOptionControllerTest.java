package com.platform.core.design.controller;

import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.PageResponse;
import com.platform.core.design.domain.DesignDiscipline;
import com.platform.core.design.domain.DesignOptionStatus;
import com.platform.core.design.dto.CreateDesignOptionRequest;
import com.platform.core.design.dto.DesignFeedbackDto;
import com.platform.core.design.dto.DesignFeedbackRequest;
import com.platform.core.design.dto.DesignOptionDto;
import com.platform.core.design.service.DesignFeedbackService;
import com.platform.core.design.service.DesignOptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 设计选项控制器单元测试
 *
 * 覆盖：分页查询、创建、详情、提交反馈、反馈列表。
 */
@ExtendWith(MockitoExtension.class)
class DesignOptionControllerTest {

    @Mock
    private DesignOptionService optionService;

    @Mock
    private DesignFeedbackService feedbackService;

    private DesignOptionController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID optionId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new DesignOptionController(optionService, feedbackService);
    }

    @Test
    @DisplayName("GET 分页查询应该返回 PageResponse")
    void listShouldReturnPageResponse() {
        // Arrange
        DesignOptionDto dto = buildOptionDto();
        Page<DesignOptionDto> page = new PageImpl<>(List.of(dto));
        when(optionService.list(eq(tenantId), eq(projectId), eq(DesignOptionStatus.CANDIDATE),
                eq(DesignDiscipline.ARCHITECTURE), eq(1), eq(20)))
                .thenReturn(page);

        // Act
        PageResponse<DesignOptionDto> response = controller.list(
                tenantId, projectId, 1, 20,
                DesignOptionStatus.CANDIDATE, DesignDiscipline.ARCHITECTURE);

        // Assert
        assertThat(response.code()).isZero();
        assertThat(response.data()).isNotNull();
        assertThat(response.data().list()).hasSize(1);
        assertThat(response.data().total()).isEqualTo(1L);
        assertThat(response.data().page()).isEqualTo(1);
        assertThat(response.data().pageSize()).isEqualTo(20);
        verify(optionService).list(eq(tenantId), eq(projectId), eq(DesignOptionStatus.CANDIDATE),
                eq(DesignDiscipline.ARCHITECTURE), eq(1), eq(20));
    }

    @Test
    @DisplayName("POST 创建设计选项应该返回成功响应")
    void createShouldReturnSuccess() {
        // Arrange
        CreateDesignOptionRequest request = new CreateDesignOptionRequest(
                projectId, "方案 A", "初始方案", DesignDiscipline.ARCHITECTURE, "{}", null);
        DesignOptionDto dto = buildOptionDto();
        when(optionService.create(eq(tenantId), eq(request), eq(userId))).thenReturn(dto);

        // Act
        ApiResponse<DesignOptionDto> response = controller.create(tenantId, request, userId);

        // Assert
        assertThat(response.code()).isZero();
        assertThat(response.data().id()).isEqualTo(optionId);
        verify(optionService).create(eq(tenantId), eq(request), eq(userId));
    }

    @Test
    @DisplayName("GET /{optionId} 应该返回设计选项详情")
    void getShouldReturnOptionDetail() {
        // Arrange
        DesignOptionDto dto = buildOptionDto();
        when(optionService.get(eq(tenantId), eq(optionId))).thenReturn(dto);

        // Act
        ApiResponse<DesignOptionDto> response = controller.get(tenantId, optionId);

        // Assert
        assertThat(response.data().id()).isEqualTo(optionId);
        verify(optionService).get(eq(tenantId), eq(optionId));
    }

    @Test
    @DisplayName("POST /{optionId}/feedback 应该调用反馈服务提交反馈")
    void submitFeedbackShouldInvokeFeedbackService() {
        // Arrange
        DesignFeedbackRequest request = new DesignFeedbackRequest("方案合理", 5);
        DesignFeedbackDto feedbackDto = buildFeedbackDto();
        when(feedbackService.submit(eq(tenantId), eq(optionId), eq(request), eq(userId)))
                .thenReturn(feedbackDto);

        // Act
        ApiResponse<DesignFeedbackDto> response =
                controller.submitFeedback(tenantId, optionId, request, userId);

        // Assert
        assertThat(response.code()).isZero();
        assertThat(response.data().id()).isEqualTo(feedbackDto.id());
        verify(feedbackService).submit(eq(tenantId), eq(optionId), eq(request), eq(userId));
    }

    @Test
    @DisplayName("GET /{optionId}/feedback 应该返回反馈列表")
    void listFeedbackShouldReturnFeedbackList() {
        // Arrange
        DesignFeedbackDto feedbackDto = buildFeedbackDto();
        when(feedbackService.listByOption(eq(tenantId), eq(optionId)))
                .thenReturn(List.of(feedbackDto));

        // Act
        ApiResponse<List<DesignFeedbackDto>> response =
                controller.listFeedback(tenantId, optionId);

        // Assert
        assertThat(response.data()).hasSize(1);
        verify(feedbackService).listByOption(eq(tenantId), eq(optionId));
    }

    private DesignOptionDto buildOptionDto() {
        Instant now = Instant.now();
        return new DesignOptionDto(
                optionId, tenantId, projectId, "方案 A", "初始方案",
                DesignOptionStatus.DRAFT, DesignDiscipline.ARCHITECTURE,
                "{}", null, userId, now, now, 1L
        );
    }

    private DesignFeedbackDto buildFeedbackDto() {
        return new DesignFeedbackDto(
                UUID.randomUUID(), optionId, userId, "方案合理", 5, Instant.now()
        );
    }
}
