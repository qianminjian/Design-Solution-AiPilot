package com.platform.core.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.ai.domain.AiGenerationRecord;
import com.platform.core.ai.dto.AiGenerationRecordDto;
import com.platform.core.ai.dto.CreateAiGenerationRecordRequest;
import com.platform.core.ai.dto.SubmitReviewRequest;
import com.platform.core.ai.repository.AiGenerationRecordRepository;
import com.platform.core.common.response.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AI 生成记录服务单元测试
 *
 * 覆盖：创建、查询、设计选项关联、人工复核决策。
 */
@ExtendWith(MockitoExtension.class)
class AiGenerationRecordServiceTest {

    @Mock
    private AiGenerationRecordRepository repository;

    private ObjectMapper objectMapper;
    private AiGenerationRecordService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID recordId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new AiGenerationRecordService(repository, objectMapper);
    }

    @Test
    @DisplayName("create 应该保存实体并返回 DTO")
    void createShouldSaveAndReturnDto() {
        // Arrange
        CreateAiGenerationRecordRequest request = new CreateAiGenerationRecordRequest(
                projectId, null, "concept-generation", Map.of("brief", "办公"),
                "rendered prompt", "raw content", Map.of("candidates", List.of()),
                "gpt-4o", Map.of("totalTokens", 100), "medium", Map.of("passed", true),
                true, 1200, "trace-001"
        );
        AiGenerationRecord saved = buildRecord();
        when(repository.save(any())).thenReturn(saved);

        // Act
        AiGenerationRecordDto dto = service.create(tenantId, request, userId);

        // Assert
        assertThat(dto.projectId()).isEqualTo(projectId);
        verify(repository).save(any(AiGenerationRecord.class));
    }

    @Test
    @DisplayName("create 在 requiresHumanReview=null 时应该默认为 true")
    void createShouldDefaultRequiresHumanReviewToTrueWhenNull() {
        // Arrange
        CreateAiGenerationRecordRequest request = new CreateAiGenerationRecordRequest(
                projectId, null, "concept-generation", null,
                "rendered prompt", "raw content", Map.of("candidates", List.of()),
                "gpt-4o", Map.of("totalTokens", 100), "medium", Map.of("passed", true),
                null, null, null
        );
        AiGenerationRecord saved = buildRecord();
        when(repository.save(any())).thenAnswer(inv -> {
            AiGenerationRecord e = inv.getArgument(0);
            // 验证默认值已被设置
            assertThat(e.getRequiresHumanReview()).isTrue();
            assertThat(e.getLatencyMs()).isEqualTo(0);
            return e;
        });

        // Act
        service.create(tenantId, request, userId);

        // Assert 在 thenAnswer 中已验证
        verify(repository).save(any(AiGenerationRecord.class));
    }

    @Test
    @DisplayName("listByProject 应按时间倒序返回项目下记录列表")
    void listByProjectShouldReturnRecordsOrderByCreatedAtDesc() {
        // Arrange
        AiGenerationRecord r1 = buildRecord();
        r1.setCreatedAt(Instant.now());
        AiGenerationRecord r2 = buildRecord();
        r2.setCreatedAt(Instant.now().plusSeconds(60));
        when(repository.findByTenantIdAndProjectIdOrderByCreatedAtDesc(tenantId, projectId))
                .thenReturn(List.of(r2, r1));

        // Act
        List<AiGenerationRecordDto> list = service.listByProject(tenantId, projectId);

        // Assert
        assertThat(list).hasSize(2);
        verify(repository).findByTenantIdAndProjectIdOrderByCreatedAtDesc(tenantId, projectId);
    }

    @Test
    @DisplayName("listPendingReviews 应返回项目下 PENDING 状态记录")
    void listPendingReviewsShouldReturnOnlyPendingRecords() {
        // Arrange
        AiGenerationRecord pending = buildRecord();
        pending.setReviewStatus("PENDING");
        when(repository.findByTenantIdAndProjectIdAndReviewStatus(tenantId, projectId, "PENDING"))
                .thenReturn(List.of(pending));

        // Act
        List<AiGenerationRecordDto> list = service.listPendingReviews(tenantId, projectId);

        // Assert
        assertThat(list).hasSize(1);
        assertThat(list.get(0).reviewStatus()).isEqualTo("PENDING");
    }

    @Test
    @DisplayName("linkDesignOption 应成功关联设计选项")
    void linkDesignOptionShouldAssociateDesignOption() {
        // Arrange
        UUID designOptionId = UUID.randomUUID();
        AiGenerationRecord record = buildRecord();
        when(repository.findByIdAndTenantId(recordId, tenantId)).thenReturn(Optional.of(record));
        when(repository.save(any())).thenReturn(record);

        // Act
        AiGenerationRecordDto dto = service.linkDesignOption(tenantId, recordId, designOptionId);

        // Assert
        assertThat(dto.designOptionId()).isEqualTo(designOptionId);
        verify(repository).save(any(AiGenerationRecord.class));
    }

    @Test
    @DisplayName("linkDesignOption 在记录不存在时应抛出异常")
    void linkDesignOptionShouldThrowWhenRecordNotFound() {
        // Arrange
        when(repository.findByIdAndTenantId(recordId, tenantId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> service.linkDesignOption(tenantId, recordId, UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("AI 生成记录不存在");
    }

    @Test
    @DisplayName("submitReview critical 风险等级应校验双人复核与签章")
    void submitReviewCriticalRiskShouldValidateTwoPersonReview() {
        // Arrange
        AiGenerationRecord record = buildRecord();
        record.setRiskLevel("critical");
        record.setRequiresHumanReview(true);
        record.setReviewStatus("PENDING");
        when(repository.findByIdAndTenantId(recordId, tenantId)).thenReturn(Optional.of(record));

        SubmitReviewRequest request = new SubmitReviewRequest(
                "APPROVED", "通过", null  // 缺少 decisionContext
        );

        // Act & Assert
        assertThatThrownBy(() -> service.submitReview(tenantId, recordId, request, userId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("双人复核");
    }

    @Test
    @DisplayName("submitReview 高风险但 decisionContext 缺少 signer 应抛异常")
    void submitReviewHighRiskMissingSignerShouldThrow() {
        // Arrange
        AiGenerationRecord record = buildRecord();
        record.setRiskLevel("high");
        record.setRequiresHumanReview(true);
        record.setReviewStatus("PENDING");
        when(repository.findByIdAndTenantId(recordId, tenantId)).thenReturn(Optional.of(record));

        SubmitReviewRequest request = new SubmitReviewRequest(
                "APPROVED", "通过", Map.of("secondReviewer", "reviewer-002")  // 缺少 signer
        );

        // Act & Assert
        assertThatThrownBy(() -> service.submitReview(tenantId, recordId, request, userId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("双人复核");
    }

    @Test
    @DisplayName("submitReview 高风险完整 decisionContext 应成功")
    void submitReviewHighRiskWithFullContextShouldSucceed() {
        // Arrange
        AiGenerationRecord record = buildRecord();
        record.setRiskLevel("high");
        record.setRequiresHumanReview(true);
        record.setReviewStatus("PENDING");
        when(repository.findByIdAndTenantId(recordId, tenantId)).thenReturn(Optional.of(record));
        when(repository.save(any())).thenReturn(record);

        SubmitReviewRequest request = new SubmitReviewRequest(
                "APPROVED", "通过",
                Map.of("secondReviewer", "reviewer-002", "signer", "architect-001")
        );

        // Act
        AiGenerationRecordDto dto = service.submitReview(tenantId, recordId, request, userId);

        // Assert
        assertThat(dto.reviewStatus()).isEqualTo("APPROVED");
        verify(repository).save(any(AiGenerationRecord.class));
    }

    @Test
    @DisplayName("submitReview requiresHumanReview=false 应拒绝复核")
    void submitReviewShouldRejectWhenNoHumanReviewRequired() {
        // Arrange
        AiGenerationRecord record = buildRecord();
        record.setRequiresHumanReview(false);
        record.setReviewStatus("PENDING");
        when(repository.findByIdAndTenantId(recordId, tenantId)).thenReturn(Optional.of(record));

        SubmitReviewRequest request = new SubmitReviewRequest("APPROVED", "通过", null);

        // Act & Assert
        assertThatThrownBy(() -> service.submitReview(tenantId, recordId, request, userId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("无需人工复核");
    }

    @Test
    @DisplayName("get 应该返回记录详情")
    void getShouldReturnRecord() {
        // Arrange
        AiGenerationRecord record = buildRecord();
        when(repository.findByIdAndTenantId(recordId, tenantId)).thenReturn(Optional.of(record));

        // Act
        AiGenerationRecordDto dto = service.get(tenantId, recordId);

        // Assert
        assertThat(dto.id()).isEqualTo(recordId);
    }

    @Test
    @DisplayName("get 不存在时应该抛出异常")
    void getNotFoundShouldThrow() {
        // Arrange
        when(repository.findByIdAndTenantId(recordId, tenantId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> service.get(tenantId, recordId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("AI 生成记录不存在");
    }

    @Test
    @DisplayName("listByDesignOption 应该返回关联记录列表")
    void listByDesignOptionShouldReturnList() {
        // Arrange
        UUID designOptionId = UUID.randomUUID();
        AiGenerationRecord record = buildRecord();
        when(repository.findByTenantIdAndDesignOptionId(tenantId, designOptionId))
                .thenReturn(List.of(record));

        // Act
        List<AiGenerationRecordDto> list = service.listByDesignOption(tenantId, designOptionId);

        // Assert
        assertThat(list).hasSize(1);
    }

    @Test
    @DisplayName("submitReview 高风险记录应该校验双人复核")
    void submitReviewHighRiskShouldValidateTwoPersonReview() {
        // Arrange
        AiGenerationRecord record = buildRecord();
        record.setRiskLevel("high");
        record.setRequiresHumanReview(true);
        record.setReviewStatus("PENDING");
        when(repository.findByIdAndTenantId(recordId, tenantId)).thenReturn(Optional.of(record));

        SubmitReviewRequest request = new SubmitReviewRequest(
                "APPROVED", "通过", null
        );

        // Act & Assert
        assertThatThrownBy(() -> service.submitReview(tenantId, recordId, request, userId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("双人复核");
    }

    @Test
    @DisplayName("submitReview 已复核记录不应该允许重复提交")
    void submitReviewAlreadyReviewedShouldThrow() {
        // Arrange
        AiGenerationRecord record = buildRecord();
        record.setReviewStatus("APPROVED");
        when(repository.findByIdAndTenantId(recordId, tenantId)).thenReturn(Optional.of(record));

        SubmitReviewRequest request = new SubmitReviewRequest("REJECTED", "驳回", Map.of());

        // Act & Assert
        assertThatThrownBy(() -> service.submitReview(tenantId, recordId, request, userId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("已复核");
    }

    @Test
    @DisplayName("submitReview 正常提交应该更新状态")
    void submitReviewShouldUpdateStatus() {
        // Arrange
        AiGenerationRecord record = buildRecord();
        record.setRequiresHumanReview(true);
        record.setReviewStatus("PENDING");
        record.setRiskLevel("low");
        when(repository.findByIdAndTenantId(recordId, tenantId)).thenReturn(Optional.of(record));
        when(repository.save(any())).thenReturn(record);

        SubmitReviewRequest request = new SubmitReviewRequest("APPROVED", "通过", null);

        // Act
        AiGenerationRecordDto dto = service.submitReview(tenantId, recordId, request, userId);

        // Assert
        verify(repository).save(any());
    }

    private AiGenerationRecord buildRecord() {
        AiGenerationRecord record = new AiGenerationRecord();
        record.setId(recordId);
        record.setTenantId(tenantId);
        record.setProjectId(projectId);
        record.setPromptTemplate("concept-generation");
        record.setModel("gpt-4o");
        record.setRiskLevel("medium");
        record.setRequiresHumanReview(true);
        record.setReviewStatus("PENDING");
        record.setLatencyMs(1200);
        record.setTraceId("trace-001");
        record.setCreatedAt(Instant.now());
        record.setUpdatedAt(Instant.now());
        return record;
    }
}