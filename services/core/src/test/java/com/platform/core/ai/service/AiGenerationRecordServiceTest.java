package com.platform.core.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.ai.domain.AiGenerationRecord;
import com.platform.core.ai.dto.AiGenerationRecordDto;
import com.platform.core.ai.dto.CreateAiGenerationRecordRequest;
import com.platform.core.ai.repository.AiGenerationRecordRepository;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AI 生成记录服务单元测试
 *
 * 覆盖：创建、查询详情、按设计选项反查、按项目查询、关联设计选项、JSON 序列化与异常路径。
 * 全部使用 Mockito Mock Repository，纯 JVM 运行，无容器依赖。
 */
@ExtendWith(MockitoExtension.class)
class AiGenerationRecordServiceTest {

    @Mock
    private AiGenerationRecordRepository repository;

    private ObjectMapper objectMapper;
    private AiGenerationRecordService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID recordId = UUID.randomUUID();
    private final UUID designOptionId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.findAndRegisterModules();
        service = new AiGenerationRecordService(repository, objectMapper);
    }

    @Test
    @DisplayName("应该成功创建 AI 生成记录并持久化 JSONB 字段")
    void shouldCreateRecordSuccessfully() {
        // Arrange
        Map<String, Object> variables = Map.of("buildingType", "office", "floors", 10);
        Map<String, Object> candidates = Map.of("candidate1", Map.of("title", "方案一"));
        Map<String, Object> tokenUsage = Map.of("promptTokens", 500, "completionTokens", 800);
        Map<String, Object> guardrailResult = Map.of("passed", true, "warnings", List.of());

        ArgumentCaptor<AiGenerationRecord> captor = ArgumentCaptor.forClass(AiGenerationRecord.class);
        AiGenerationRecord saved = buildPersistedRecord();
        when(repository.save(any(AiGenerationRecord.class))).thenReturn(saved);

        CreateAiGenerationRecordRequest request = new CreateAiGenerationRecordRequest(
                projectId,
                null,
                "concept-generation",
                variables,
                "rendered prompt text",
                "raw LLM content",
                candidates,
                "gpt-4o",
                tokenUsage,
                "medium",
                guardrailResult,
                Boolean.TRUE,
                1200,
                "trace-001"
        );

        // Act
        AiGenerationRecordDto dto = service.create(tenantId, request, userId);

        // Assert
        verify(repository).save(captor.capture());
        AiGenerationRecord persisted = captor.getValue();

        // 关键字段持久化校验
        assertThat(persisted.getTenantId()).isEqualTo(tenantId);
        assertThat(persisted.getProjectId()).isEqualTo(projectId);
        assertThat(persisted.getDesignOptionId()).isNull();
        assertThat(persisted.getPromptTemplate()).isEqualTo("concept-generation");
        assertThat(persisted.getRenderedPrompt()).isEqualTo("rendered prompt text");
        assertThat(persisted.getRawContent()).isEqualTo("raw LLM content");
        assertThat(persisted.getModel()).isEqualTo("gpt-4o");
        assertThat(persisted.getRiskLevel()).isEqualTo("medium");
        assertThat(persisted.getRequiresHumanReview()).isTrue();
        assertThat(persisted.getLatencyMs()).isEqualTo(1200);
        assertThat(persisted.getTraceId()).isEqualTo("trace-001");
        assertThat(persisted.getCreatedBy()).isEqualTo(userId);

        // JSONB 字段序列化校验
        assertThat(persisted.getVariables()).contains("office");
        assertThat(persisted.getCandidates()).contains("candidate1");
        assertThat(persisted.getTokenUsage()).contains("promptTokens");
        assertThat(persisted.getGuardrailResult()).contains("passed");

        // 返回 DTO 校验
        assertThat(dto.id()).isEqualTo(recordId);
        assertThat(dto.model()).isEqualTo("gpt-4o");
        assertThat(dto.riskLevel()).isEqualTo("medium");
        assertThat(dto.requiresHumanReview()).isTrue();
    }

    @Test
    @DisplayName("应该在未提供 requiresHumanReview 时默认设置为 true（AI 安全红线）")
    void shouldDefaultRequiresHumanReviewToTrueWhenNull() {
        // Arrange
        ArgumentCaptor<AiGenerationRecord> captor = ArgumentCaptor.forClass(AiGenerationRecord.class);
        when(repository.save(any(AiGenerationRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateAiGenerationRecordRequest request = minimalRequest();
        // requiresHumanReview 与 latencyMs 均为 null

        // Act
        service.create(tenantId, request, userId);

        // Assert
        verify(repository).save(captor.capture());
        AiGenerationRecord persisted = captor.getValue();
        assertThat(persisted.getRequiresHumanReview()).isTrue();
        assertThat(persisted.getLatencyMs()).isZero();
    }

    @Test
    @DisplayName("应该在 latencyMs 为 null 时默认 0")
    void shouldDefaultLatencyMsToZeroWhenNull() {
        // Arrange
        ArgumentCaptor<AiGenerationRecord> captor = ArgumentCaptor.forClass(AiGenerationRecord.class);
        when(repository.save(any(AiGenerationRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateAiGenerationRecordRequest request = new CreateAiGenerationRecordRequest(
                projectId, null, "tpl", null, "rp", "raw",
                Map.of("k", "v"), "m", Map.of(), "low",
                Map.of("passed", true),
                null, null, null
        );

        // Act
        service.create(tenantId, request, userId);

        // Assert
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getLatencyMs()).isZero();
    }

    @Test
    @DisplayName("应该成功查询 AI 生成记录详情并反序列化 JSONB 字段")
    void shouldGetRecordSuccessfully() {
        // Arrange
        AiGenerationRecord record = buildPersistedRecord();
        record.setVariables("{\"key\":\"value\"}");
        record.setCandidates("{\"candidate1\":{\"title\":\"方案一\"}}");
        record.setTokenUsage("{\"promptTokens\":500}");
        record.setGuardrailResult("{\"passed\":true,\"warnings\":[]}");
        when(repository.findByIdAndTenantId(eq(recordId), eq(tenantId)))
                .thenReturn(Optional.of(record));

        // Act
        AiGenerationRecordDto dto = service.get(tenantId, recordId);

        // Assert
        assertThat(dto.id()).isEqualTo(recordId);
        assertThat(dto.promptTemplate()).isEqualTo("concept-generation");
        assertThat(dto.variables()).containsEntry("key", "value");
        assertThat(dto.candidates()).containsKey("candidate1");
        assertThat(dto.tokenUsage()).containsEntry("promptTokens", 500);
        assertThat(dto.guardrailResult()).containsEntry("passed", true);
    }

    @Test
    @DisplayName("应该在记录不存在时抛出业务异常")
    void shouldThrowWhenRecordNotFound() {
        // Arrange
        when(repository.findByIdAndTenantId(eq(recordId), eq(tenantId)))
                .thenReturn(Optional.empty());

        // Act + Assert
        assertThatThrownBy(() -> service.get(tenantId, recordId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }

    @Test
    @DisplayName("应该按设计选项反查 AI 生成记录（审计追溯：设计选项 → AI 来源）")
    void shouldListByDesignOption() {
        // Arrange
        AiGenerationRecord r1 = buildPersistedRecord();
        r1.setDesignOptionId(designOptionId);
        AiGenerationRecord r2 = buildPersistedRecord();
        r2.setId(UUID.randomUUID());
        r2.setDesignOptionId(designOptionId);
        r2.setTraceId("trace-002");
        when(repository.findByTenantIdAndDesignOptionId(eq(tenantId), eq(designOptionId)))
                .thenReturn(List.of(r1, r2));

        // Act
        List<AiGenerationRecordDto> dtos = service.listByDesignOption(tenantId, designOptionId);

        // Assert
        assertThat(dtos).hasSize(2);
        assertThat(dtos).allSatisfy(dto -> assertThat(dto.designOptionId()).isEqualTo(designOptionId));
    }

    @Test
    @DisplayName("应该按项目查询 AI 生成记录（按时间倒序）")
    void shouldListByProject() {
        // Arrange
        AiGenerationRecord r1 = buildPersistedRecord();
        AiGenerationRecord r2 = buildPersistedRecord();
        r2.setId(UUID.randomUUID());
        r2.setTraceId("trace-002");
        when(repository.findByTenantIdAndProjectIdOrderByCreatedAtDesc(eq(tenantId), eq(projectId)))
                .thenReturn(List.of(r1, r2));

        // Act
        List<AiGenerationRecordDto> dtos = service.listByProject(tenantId, projectId);

        // Assert
        assertThat(dtos).hasSize(2);
        verify(repository).findByTenantIdAndProjectIdOrderByCreatedAtDesc(eq(tenantId), eq(projectId));
    }

    @Test
    @DisplayName("应该成功关联设计选项（接受候选为设计选项时回填 designOptionId）")
    void shouldLinkDesignOptionSuccessfully() {
        // Arrange
        AiGenerationRecord existing = buildPersistedRecord();
        existing.setDesignOptionId(null);
        when(repository.findByIdAndTenantId(eq(recordId), eq(tenantId)))
                .thenReturn(Optional.of(existing));
        when(repository.save(any(AiGenerationRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        // Act
        AiGenerationRecordDto dto = service.linkDesignOption(tenantId, recordId, designOptionId);

        // Assert
        ArgumentCaptor<AiGenerationRecord> captor = ArgumentCaptor.forClass(AiGenerationRecord.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getDesignOptionId()).isEqualTo(designOptionId);
        assertThat(dto.designOptionId()).isEqualTo(designOptionId);
    }

    @Test
    @DisplayName("应该在关联设计选项时记录不存在抛出业务异常")
    void shouldThrowWhenLinkDesignOptionButRecordNotFound() {
        // Arrange
        when(repository.findByIdAndTenantId(eq(recordId), eq(tenantId)))
                .thenReturn(Optional.empty());

        // Act + Assert
        assertThatThrownBy(() -> service.linkDesignOption(tenantId, recordId, designOptionId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }

    @Test
    @DisplayName("应该在 JSONB 字段反序列化失败时返回 _raw 包装，避免查询失败")
    void shouldFallbackToRawWhenJsonInvalid() {
        // Arrange：构造存储层 JSON 异常场景
        AiGenerationRecord record = buildPersistedRecord();
        record.setVariables("not-a-json");
        when(repository.findByIdAndTenantId(eq(recordId), eq(tenantId)))
                .thenReturn(Optional.of(record));

        // Act
        AiGenerationRecordDto dto = service.get(tenantId, recordId);

        // Assert：降级为 _raw 字段包装，不抛异常
        assertThat(dto.variables()).containsKey("_raw");
        assertThat(dto.variables().get("_raw")).isEqualTo("not-a-json");
    }

    // ── 人工复核闭环测试（security.md §12 AI 安全红线） ──

    @Test
    @DisplayName("listPendingReviews 应该返回项目内 PENDING 状态的记录")
    void listPendingReviewsShouldReturnOnlyPendingRecords() {
        // Arrange
        AiGenerationRecord pending1 = buildPersistedRecord();
        pending1.setReviewStatus("PENDING");
        AiGenerationRecord pending2 = buildPersistedRecord();
        pending2.setId(UUID.randomUUID());
        pending2.setReviewStatus("PENDING");
        when(repository.findByTenantIdAndProjectIdAndReviewStatus(eq(tenantId), eq(projectId), eq("PENDING")))
                .thenReturn(List.of(pending1, pending2));

        // Act
        List<AiGenerationRecordDto> result = service.listPendingReviews(tenantId, projectId);

        // Assert
        assertThat(result).hasSize(2);
        assertThat(result).allSatisfy(dto -> assertThat(dto.reviewStatus()).isEqualTo("PENDING"));
        verify(repository).findByTenantIdAndProjectIdAndReviewStatus(eq(tenantId), eq(projectId), eq("PENDING"));
    }

    @Test
    @DisplayName("submitReview 应该将 PENDING 状态更新为 APPROVED 并记录复核信息")
    void submitReviewShouldUpdateStatusToApproved() {
        // Arrange
        AiGenerationRecord record = buildPersistedRecord();
        record.setReviewStatus("PENDING");
        record.setRiskLevel("medium");
        when(repository.findByIdAndTenantId(eq(recordId), eq(tenantId)))
                .thenReturn(Optional.of(record));
        when(repository.save(any(AiGenerationRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        com.platform.core.ai.dto.SubmitReviewRequest request = new com.platform.core.ai.dto.SubmitReviewRequest(
                "APPROVED", "符合规范要求", null
        );

        // Act
        AiGenerationRecordDto dto = service.submitReview(tenantId, recordId, request, userId);

        // Assert：状态变更、复核信息持久化
        assertThat(dto.reviewStatus()).isEqualTo("APPROVED");
        assertThat(dto.reviewerId()).isEqualTo(userId);
        assertThat(dto.reviewComment()).isEqualTo("符合规范要求");
        assertThat(dto.reviewedAt()).isNotNull();
    }

    @Test
    @DisplayName("submitReview 应该拒绝 requiresHumanReview=false 的记录")
    void submitReviewShouldRejectRecordNotRequiringReview() {
        // Arrange
        AiGenerationRecord record = buildPersistedRecord();
        record.setRequiresHumanReview(Boolean.FALSE);
        record.setReviewStatus("PENDING");
        when(repository.findByIdAndTenantId(eq(recordId), eq(tenantId)))
                .thenReturn(Optional.of(record));

        com.platform.core.ai.dto.SubmitReviewRequest request = new com.platform.core.ai.dto.SubmitReviewRequest(
                "APPROVED", null, null
        );

        // Act + Assert
        assertThatThrownBy(() -> service.submitReview(tenantId, recordId, request, userId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("无需人工复核");
    }

    @Test
    @DisplayName("submitReview 应该拒绝已复核记录的重复提交")
    void submitReviewShouldRejectAlreadyReviewedRecord() {
        // Arrange
        AiGenerationRecord record = buildPersistedRecord();
        record.setReviewStatus("APPROVED"); // 已复核
        when(repository.findByIdAndTenantId(eq(recordId), eq(tenantId)))
                .thenReturn(Optional.of(record));

        com.platform.core.ai.dto.SubmitReviewRequest request = new com.platform.core.ai.dto.SubmitReviewRequest(
                "REJECTED", null, null
        );

        // Act + Assert
        assertThatThrownBy(() -> service.submitReview(tenantId, recordId, request, userId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("记录已复核");
    }

    @Test
    @DisplayName("submitReview 应该对高风险记录强制双人复核与注册师签章校验")
    void submitReviewShouldEnforceDualReviewForHighRisk() {
        // Arrange：高风险记录 + 未提供 secondReviewer 与 signer
        AiGenerationRecord record = buildPersistedRecord();
        record.setReviewStatus("PENDING");
        record.setRiskLevel("high");
        when(repository.findByIdAndTenantId(eq(recordId), eq(tenantId)))
                .thenReturn(Optional.of(record));

        com.platform.core.ai.dto.SubmitReviewRequest request = new com.platform.core.ai.dto.SubmitReviewRequest(
                "APPROVED", null, Map.of() // 空 decisionContext
        );

        // Act + Assert：高风险须双人复核 + 签章
        assertThatThrownBy(() -> service.submitReview(tenantId, recordId, request, userId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("双人复核")
                .hasMessageContaining("签章");
    }

    @Test
    @DisplayName("submitReview 应该接受高风险记录并提供完整签章信息")
    void submitReviewShouldAcceptHighRiskWithFullSigner() {
        // Arrange：高风险 + 提供完整 secondReviewer 与 signer
        AiGenerationRecord record = buildPersistedRecord();
        record.setReviewStatus("PENDING");
        record.setRiskLevel("critical");
        when(repository.findByIdAndTenantId(eq(recordId), eq(tenantId)))
                .thenReturn(Optional.of(record));
        when(repository.save(any(AiGenerationRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> decisionContext = Map.of(
                "secondReviewer", "user-002",
                "signer", Map.of("name", "张工", "certificateNo", "REG-001")
        );
        com.platform.core.ai.dto.SubmitReviewRequest request = new com.platform.core.ai.dto.SubmitReviewRequest(
                "APPROVED", "极高风险已双人复核", decisionContext
        );

        // Act
        AiGenerationRecordDto dto = service.submitReview(tenantId, recordId, request, userId);

        // Assert：决策上下文已序列化存储
        assertThat(dto.reviewStatus()).isEqualTo("APPROVED");
        assertThat(dto.reviewDecision()).isNotNull();
        assertThat(dto.reviewDecision()).containsKey("secondReviewer");
    }

    // ── 辅助方法 ──

    /** 构造已持久化的记录（带 id、时间戳） */
    private AiGenerationRecord buildPersistedRecord() {
        AiGenerationRecord record = new AiGenerationRecord();
        record.setId(recordId);
        record.setTenantId(tenantId);
        record.setProjectId(projectId);
        record.setPromptTemplate("concept-generation");
        record.setRenderedPrompt("rendered prompt");
        record.setRawContent("raw content");
        record.setModel("gpt-4o");
        record.setRiskLevel("medium");
        record.setRequiresHumanReview(Boolean.TRUE);
        record.setLatencyMs(1200);
        record.setTraceId("trace-001");
        record.setCreatedBy(userId);
        record.setCreatedAt(Instant.now());
        record.setUpdatedAt(Instant.now());
        record.setRowVersion(1L);
        return record;
    }

    /** 构造最小化创建请求 */
    private CreateAiGenerationRecordRequest minimalRequest() {
        return new CreateAiGenerationRecordRequest(
                projectId, null, "tpl", new HashMap<>(),
                "rendered", "raw",
                new HashMap<>(), "model",
                new HashMap<>(), "low",
                new HashMap<>(),
                null, null, null
        );
    }
}
