package com.platform.core.ai.domain;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link AiGenerationRecord} 实体单元测试
 *
 * <p>AiGenerationRecord 是 AI 安全红线审计追溯的核心实体（security.md §12），
 * 必须满足以下不变量：
 * <ul>
 *   <li>新建实例 requiresHumanReview 默认为 true（安全红线）</li>
 *   <li>新建实例 latencyMs 默认为 0</li>
 *   <li>新建实例 reviewStatus 默认为 PENDING</li>
 *   <li>所有字段 setter/getter 行为正确</li>
 * </ul>
 */
@DisplayName("AiGenerationRecord AI 生成记录实体")
class AiGenerationRecordTest {

    @Test
    @DisplayName("新建实例 requiresHumanReview 应默认为 true（AI 安全红线）")
    void shouldDefaultRequiresHumanReviewToTrue() {
        // Arrange & Act
        AiGenerationRecord record = new AiGenerationRecord();

        // Assert
        // security.md §12：所有 AI 输出必须进入人工复核流程，默认值不可为 false
        assertThat(record.getRequiresHumanReview()).isTrue();
    }

    @Test
    @DisplayName("新建实例 latencyMs 应默认为 0")
    void shouldDefaultLatencyMsToZero() {
        // Arrange & Act
        AiGenerationRecord record = new AiGenerationRecord();

        // Assert
        assertThat(record.getLatencyMs()).isEqualTo(0);
    }

    @Test
    @DisplayName("新建实例 reviewStatus 应默认为 PENDING")
    void shouldDefaultReviewStatusToPending() {
        // Arrange & Act
        AiGenerationRecord record = new AiGenerationRecord();

        // Assert
        assertThat(record.getReviewStatus()).isEqualTo("PENDING");
    }

    @Test
    @DisplayName("新建实例 reviewerId / reviewedAt / reviewComment 应为 null")
    void shouldInitializeReviewFieldsToNull() {
        // Arrange & Act
        AiGenerationRecord record = new AiGenerationRecord();

        // Assert
        assertThat(record.getReviewerId()).isNull();
        assertThat(record.getReviewedAt()).isNull();
        assertThat(record.getReviewComment()).isNull();
        assertThat(record.getReviewDecision()).isNull();
    }

    @Test
    @DisplayName("新建实例 designOptionId / traceId 应为 null（接受候选前无 designOption 关联）")
    void shouldInitializeOptionalFieldsToNull() {
        // Arrange & Act
        AiGenerationRecord record = new AiGenerationRecord();

        // Assert
        assertThat(record.getDesignOptionId()).isNull();
        assertThat(record.getTraceId()).isNull();
    }

    @Nested
    @DisplayName("字段 setter/getter")
    class SetterGetter {

        private AiGenerationRecord record;

        @BeforeEach
        void setUp() {
            record = new AiGenerationRecord();
        }

        @Test
        @DisplayName("setId/getId 应正确往返")
        void shouldRoundTripId() {
            // Arrange
            UUID id = UUID.randomUUID();

            // Act
            record.setId(id);

            // Assert
            assertThat(record.getId()).isEqualTo(id);
        }

        @Test
        @DisplayName("setProjectId/getProjectId 应正确往返")
        void shouldRoundTripProjectId() {
            // Arrange
            UUID projectId = UUID.randomUUID();

            // Act
            record.setProjectId(projectId);

            // Assert
            assertThat(record.getProjectId()).isEqualTo(projectId);
        }

        @Test
        @DisplayName("setDesignOptionId/getDesignOptionId 应正确往返（接受候选后回填）")
        void shouldRoundTripDesignOptionId() {
            // Arrange
            UUID designOptionId = UUID.randomUUID();

            // Act
            record.setDesignOptionId(designOptionId);

            // Assert
            assertThat(record.getDesignOptionId()).isEqualTo(designOptionId);
        }

        @Test
        @DisplayName("setPromptTemplate/getPromptTemplate 应正确往返")
        void shouldRoundTripPromptTemplate() {
            // Arrange
            String template = "design-option-v1";

            // Act
            record.setPromptTemplate(template);

            // Assert
            assertThat(record.getPromptTemplate()).isEqualTo(template);
        }

        @Test
        @DisplayName("setRenderedPrompt/getRenderedPrompt 应正确往返")
        void shouldRoundTripRenderedPrompt() {
            // Arrange
            String prompt = "Generate design option for office building...";

            // Act
            record.setRenderedPrompt(prompt);

            // Assert
            assertThat(record.getRenderedPrompt()).isEqualTo(prompt);
        }

        @Test
        @DisplayName("setRawContent/getRawContent 应正确往返")
        void shouldRoundTripRawContent() {
            // Arrange
            String content = "## 设计方案\n本方案采用框架结构...";

            // Act
            record.setRawContent(content);

            // Assert
            assertThat(record.getRawContent()).isEqualTo(content);
        }

        @Test
        @DisplayName("setCandidates/getCandidates 应正确往返")
        void shouldRoundTripCandidates() {
            // Arrange
            String candidates = "[{\"id\":\"c1\",\"content\":\"option A\"}]";

            // Act
            record.setCandidates(candidates);

            // Assert
            assertThat(record.getCandidates()).isEqualTo(candidates);
        }

        @Test
        @DisplayName("setModel/getModel 应正确往返")
        void shouldRoundTripModel() {
            // Arrange
            String model = "claude-3-opus";

            // Act
            record.setModel(model);

            // Assert
            assertThat(record.getModel()).isEqualTo(model);
        }

        @Test
        @DisplayName("setTokenUsage/getTokenUsage 应正确往返")
        void shouldRoundTripTokenUsage() {
            // Arrange
            String usage = "{\"input\":1024,\"output\":2048}";

            // Act
            record.setTokenUsage(usage);

            // Assert
            assertThat(record.getTokenUsage()).isEqualTo(usage);
        }

        @Test
        @DisplayName("setRiskLevel/getRiskLevel 应正确往返")
        void shouldRoundTripRiskLevel() {
            // Arrange
            String riskLevel = "HIGH";

            // Act
            record.setRiskLevel(riskLevel);

            // Assert
            assertThat(record.getRiskLevel()).isEqualTo(riskLevel);
        }

        @Test
        @DisplayName("setGuardrailResult/getGuardrailResult 应正确往返")
        void shouldRoundTripGuardrailResult() {
            // Arrange
            String guardrail = "{\"passed\":true,\"violations\":[]}";

            // Act
            record.setGuardrailResult(guardrail);

            // Assert
            assertThat(record.getGuardrailResult()).isEqualTo(guardrail);
        }

        @Test
        @DisplayName("setRequiresHumanReview 为 false 时应可被读取（极高风险仍需强制复核，由业务层校验）")
        void shouldAllowSettingRequiresHumanReviewToFalse() {
            // Arrange & Act
            record.setRequiresHumanReview(false);

            // Assert
            // 实体层允许 setter，业务层负责强制复核红线（security.md §12 极高风险双人复核）
            assertThat(record.getRequiresHumanReview()).isFalse();
        }

        @Test
        @DisplayName("setLatencyMs/getLatencyMs 应正确往返")
        void shouldRoundTripLatencyMs() {
            // Arrange
            Integer latency = 1500;

            // Act
            record.setLatencyMs(latency);

            // Assert
            assertThat(record.getLatencyMs()).isEqualTo(latency);
        }

        @Test
        @DisplayName("setTraceId/getTraceId 应正确往返")
        void shouldRoundTripTraceId() {
            // Arrange
            String traceId = "trace-abc-123";

            // Act
            record.setTraceId(traceId);

            // Assert
            assertThat(record.getTraceId()).isEqualTo(traceId);
        }

        @Test
        @DisplayName("setReviewStatus/getReviewStatus 应正确往返")
        void shouldRoundTripReviewStatus() {
            // Arrange
            String status = "APPROVED";

            // Act
            record.setReviewStatus(status);

            // Assert
            assertThat(record.getReviewStatus()).isEqualTo(status);
        }

        @Test
        @DisplayName("setReviewerId/getReviewerId 应正确往返")
        void shouldRoundTripReviewerId() {
            // Arrange
            UUID reviewerId = UUID.randomUUID();

            // Act
            record.setReviewerId(reviewerId);

            // Assert
            assertThat(record.getReviewerId()).isEqualTo(reviewerId);
        }

        @Test
        @DisplayName("setReviewComment/getReviewComment 应正确往返")
        void shouldRoundTripReviewComment() {
            // Arrange
            String comment = "结构计算书已审，建议加强梁截面";

            // Act
            record.setReviewComment(comment);

            // Assert
            assertThat(record.getReviewComment()).isEqualTo(comment);
        }

        @Test
        @DisplayName("setReviewedAt/getReviewedAt 应正确往返")
        void shouldRoundTripReviewedAt() {
            // Arrange
            Instant reviewedAt = Instant.parse("2026-07-26T10:30:00Z");

            // Act
            record.setReviewedAt(reviewedAt);

            // Assert
            assertThat(record.getReviewedAt()).isEqualTo(reviewedAt);
        }

        @Test
        @DisplayName("setReviewDecision/getReviewDecision 应正确往返")
        void shouldRoundTripReviewDecision() {
            // Arrange
            String decision = "{\"coReviewer\":\"user-002\",\"stamp\":\"registered-engineer\"}";

            // Act
            record.setReviewDecision(decision);

            // Assert
            assertThat(record.getReviewDecision()).isEqualTo(decision);
        }

        @Test
        @DisplayName("setVariables/getVariables 应正确往返")
        void shouldRoundTripVariables() {
            // Arrange
            String variables = "{\"buildingType\":\"office\",\"floors\":10}";

            // Act
            record.setVariables(variables);

            // Assert
            assertThat(record.getVariables()).isEqualTo(variables);
        }
    }

    @Nested
    @DisplayName("AI 安全红线场景")
    class SecurityRedline {

        @Test
        @DisplayName("完成复核流程后 reviewStatus 应为 APPROVED 或 REJECTED")
        void shouldTransitionThroughReviewStatuses() {
            // Arrange
            AiGenerationRecord record = new AiGenerationRecord();
            assertThat(record.getReviewStatus()).isEqualTo("PENDING");

            // Act - 模拟复核流程
            record.setReviewStatus("APPROVED");
            record.setReviewerId(UUID.randomUUID());
            record.setReviewedAt(Instant.now());
            record.setReviewComment("方案符合规范");

            // Assert
            assertThat(record.getReviewStatus()).isEqualTo("APPROVED");
            assertThat(record.getReviewerId()).isNotNull();
            assertThat(record.getReviewedAt()).isNotNull();
            assertThat(record.getReviewComment()).isNotNull();
        }

        @Test
        @DisplayName("高风险记录即使 requiresHumanReview 被错误设为 false，业务层仍应保留 riskLevel 标记")
        void shouldRetainRiskLevelForAudit() {
            // Arrange
            AiGenerationRecord record = new AiGenerationRecord();

            // Act
            record.setRiskLevel("CRITICAL");
            // 即使误设置，riskLevel 字段保留
            record.setRequiresHumanReview(false);

            // Assert
            // 审计追溯依赖 riskLevel 字段，业务层校验 requiresHumanReview
            assertThat(record.getRiskLevel()).isEqualTo("CRITICAL");
        }
    }
}
