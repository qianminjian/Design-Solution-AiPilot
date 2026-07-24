package com.platform.core.ai.controller;

import com.platform.core.ai.dto.AiGenerationRecordDto;
import com.platform.core.ai.dto.CreateAiGenerationRecordRequest;
import com.platform.core.ai.dto.SubmitReviewRequest;
import com.platform.core.ai.service.AiGenerationRecordService;
import com.platform.core.common.response.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
 * AI 生成记录控制器单元测试
 *
 * 覆盖：创建、查询详情、按项目/设计选项查询、待复核列表、
 * 关联设计选项、提交人工复核决策等关键路径。
 */
@ExtendWith(MockitoExtension.class)
class AiGenerationRecordControllerTest {

    @Mock
    private AiGenerationRecordService recordService;

    private AiGenerationRecordController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID recordId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID designOptionId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new AiGenerationRecordController(recordService);
    }

    @Test
    @DisplayName("POST 创建 AI 生成记录应该调用 Service 并返回成功响应")
    void createShouldInvokeServiceAndReturnSuccess() {
        // Arrange
        CreateAiGenerationRecordRequest request = new CreateAiGenerationRecordRequest(
                projectId,
                null,
                "concept-generation",
                Map.of("buildingType", "office"),
                "rendered prompt text",
                "raw content",
                Map.of("candidates", List.of()),
                "gpt-4o",
                Map.of("promptTokens", 10, "completionTokens", 50),
                "medium",
                Map.of("passed", true),
                true,
                1200,
                "trace-001"
        );
        AiGenerationRecordDto dto = buildDto();
        when(recordService.create(eq(tenantId), eq(request), eq(userId))).thenReturn(dto);

        // Act
        ApiResponse<AiGenerationRecordDto> response = controller.create(tenantId, request, userId);

        // Assert
        assertThat(response.code()).isZero();
        assertThat(response.data()).isNotNull();
        assertThat(response.data().id()).isEqualTo(recordId);
        verify(recordService).create(eq(tenantId), eq(request), eq(userId));
    }

    @Test
    @DisplayName("GET /reviews/pending 应该返回项目内待复核记录列表")
    void listPendingReviewsShouldReturnList() {
        // Arrange
        AiGenerationRecordDto dto = buildDto();
        when(recordService.listPendingReviews(eq(tenantId), eq(projectId)))
                .thenReturn(List.of(dto));

        // Act
        ApiResponse<List<AiGenerationRecordDto>> response =
                controller.listPendingReviews(tenantId, projectId);

        // Assert
        assertThat(response.code()).isZero();
        assertThat(response.data()).hasSize(1);
        assertThat(response.data().get(0).id()).isEqualTo(recordId);
        verify(recordService).listPendingReviews(eq(tenantId), eq(projectId));
    }

    @Test
    @DisplayName("GET /{id} 应该返回记录详情")
    void getShouldReturnRecordDetail() {
        // Arrange
        AiGenerationRecordDto dto = buildDto();
        when(recordService.get(eq(tenantId), eq(recordId))).thenReturn(dto);

        // Act
        ApiResponse<AiGenerationRecordDto> response = controller.get(tenantId, recordId);

        // Assert
        assertThat(response.code()).isZero();
        assertThat(response.data().id()).isEqualTo(recordId);
        verify(recordService).get(eq(tenantId), eq(recordId));
    }

    @Test
    @DisplayName("GET 按 designOptionId 查询应该返回关联记录")
    void listByDesignOptionShouldReturnRecords() {
        // Arrange
        AiGenerationRecordDto dto = buildDto();
        when(recordService.listByDesignOption(eq(tenantId), eq(designOptionId)))
                .thenReturn(List.of(dto));

        // Act
        ApiResponse<List<AiGenerationRecordDto>> response =
                controller.list(tenantId, null, designOptionId);

        // Assert
        assertThat(response.data()).hasSize(1);
        verify(recordService).listByDesignOption(eq(tenantId), eq(designOptionId));
    }

    @Test
    @DisplayName("GET 按 projectId 查询应该返回项目下记录")
    void listByProjectShouldReturnRecords() {
        // Arrange
        AiGenerationRecordDto dto = buildDto();
        when(recordService.listByProject(eq(tenantId), eq(projectId)))
                .thenReturn(List.of(dto));

        // Act
        ApiResponse<List<AiGenerationRecordDto>> response =
                controller.list(tenantId, projectId, null);

        // Assert
        assertThat(response.data()).hasSize(1);
        verify(recordService).listByProject(eq(tenantId), eq(projectId));
    }

    @Test
    @DisplayName("GET 无 projectId 与 designOptionId 应该返回空列表")
    void listWithoutFiltersShouldReturnEmptyList() {
        // Act
        ApiResponse<List<AiGenerationRecordDto>> response =
                controller.list(tenantId, null, null);

        // Assert
        assertThat(response.data()).isEmpty();
    }

    @Test
    @DisplayName("POST /{id}/link 应该调用 Service 关联设计选项")
    void linkDesignOptionShouldInvokeService() {
        // Arrange
        AiGenerationRecordDto dto = buildDto();
        when(recordService.linkDesignOption(eq(tenantId), eq(recordId), eq(designOptionId)))
                .thenReturn(dto);

        // Act
        ApiResponse<AiGenerationRecordDto> response =
                controller.linkDesignOption(tenantId, recordId, designOptionId);

        // Assert
        assertThat(response.code()).isZero();
        assertThat(response.data().id()).isEqualTo(recordId);
        verify(recordService).linkDesignOption(eq(tenantId), eq(recordId), eq(designOptionId));
    }

    @Test
    @DisplayName("PATCH /{id}/review 应该调用 Service 提交复核决策")
    void submitReviewShouldInvokeService() {
        // Arrange
        SubmitReviewRequest request = new SubmitReviewRequest(
                "APPROVED",
                "方案通过",
                Map.of("secondReviewer", "user-002", "signer", "architect-001")
        );
        AiGenerationRecordDto dto = buildDto();
        when(recordService.submitReview(eq(tenantId), eq(recordId), eq(request), eq(userId)))
                .thenReturn(dto);

        // Act
        ApiResponse<AiGenerationRecordDto> response =
                controller.submitReview(tenantId, recordId, request, userId);

        // Assert
        assertThat(response.code()).isZero();
        assertThat(response.data().id()).isEqualTo(recordId);
        verify(recordService).submitReview(eq(tenantId), eq(recordId), eq(request), eq(userId));
    }

    /**
     * 构造测试用 AI 生成记录 DTO
     */
    private AiGenerationRecordDto buildDto() {
        Instant now = Instant.now();
        return new AiGenerationRecordDto(
                recordId,
                tenantId,
                projectId,
                designOptionId,
                "concept-generation",
                Map.of("buildingType", "office"),
                "rendered prompt",
                "raw content",
                Map.of("candidates", List.of()),
                "gpt-4o",
                Map.of("promptTokens", 10, "completionTokens", 50),
                "medium",
                Map.of("passed", true),
                true,
                1200,
                "trace-001",
                "PENDING",
                null,
                null,
                null,
                null,
                userId,
                now,
                now,
                1L
        );
    }
}
