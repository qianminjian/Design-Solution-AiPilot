package com.platform.core.platform.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * OutboxEvent 领域模型单元测试
 *
 * <p>覆盖核心不变量：
 * <ul>
 *   <li>工厂方法 {@link OutboxEvent#create} 生成 PENDING 状态事件</li>
 *   <li>状态机：PENDING → PUBLISHED（markPublished）</li>
 *   <li>状态机：PENDING/FAILED → FAILED（recordFailure 未达上限）</li>
 *   <li>状态机：FAILED → DEAD_LETTER（recordFailure 达到上限）</li>
 *   <li>重试次数与 nextRetryAt 递增</li>
 * </ul>
 */
class OutboxEventTest {

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID aggregateId = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Nested
    @DisplayName("工厂方法 create()")
    class Create {

        @Test
        @DisplayName("应该创建 PENDING 状态事件，包含必要字段")
        void shouldCreatePendingEventWithRequiredFields() {
            // Arrange（准备）
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("projectId", "proj-001");

            // Act（执行）
            OutboxEvent event = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", payload, "trace-001");

            // Assert（断言）
            assertThat(event.getId()).isNotNull();
            assertThat(event.getTenantId()).isEqualTo(tenantId);
            assertThat(event.getProjectId()).isNull();
            assertThat(event.getAggregateType()).isEqualTo("Project");
            assertThat(event.getAggregateId()).isEqualTo(aggregateId);
            assertThat(event.getAggregateVersion()).isEqualTo(1L);
            assertThat(event.getEventType()).isEqualTo("ProjectCreated");
            assertThat(event.getSchemaVersion()).isEqualTo("1.0");
            assertThat(event.getOccurredAt()).isNotNull();
            assertThat(event.getPayload()).containsEntry("projectId", "proj-001");
            assertThat(event.getTraceId()).isEqualTo("trace-001");
            assertThat(event.getStatus()).isEqualTo(OutboxEventStatus.PENDING);
            assertThat(event.getPublishedAt()).isNull();
            assertThat(event.getPublishAttempts()).isZero();
            assertThat(event.getLastError()).isNull();
            assertThat(event.getNextRetryAt()).isNull();
            assertThat(event.getClassification())
                    .isEqualTo(com.platform.core.iam.domain.DataClassification.OPERATIONAL_TELEMETRY);
        }

        @Test
        @DisplayName("null payload 应使用空 Map 占位（避免 JSON 序列化失败）")
        void shouldHandleNullPayload() {
            // Act（执行）
            OutboxEvent event = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", null, null);

            // Assert（断言）
            assertThat(event.getPayload()).isNotNull().isEmpty();
            assertThat(event.getTraceId()).isNull();
        }
    }

    @Nested
    @DisplayName("状态机：markPublished")
    class MarkPublished {

        @Test
        @DisplayName("应该将状态变更为 PUBLISHED 并记录 publishedAt")
        void shouldTransitionToPublished() {
            // Arrange（准备）
            OutboxEvent event = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", Map.of(), "trace-001");

            // Act（执行）
            event.markPublished();

            // Assert（断言）
            assertThat(event.getStatus()).isEqualTo(OutboxEventStatus.PUBLISHED);
            assertThat(event.getPublishedAt()).isNotNull();
        }
    }

    @Nested
    @DisplayName("状态机：recordFailure")
    class RecordFailure {

        @Test
        @DisplayName("未达最大尝试次数时状态变为 FAILED，并设置 nextRetryAt")
        void shouldTransitionToFailedWhenBelowMaxAttempts() {
            // Arrange（准备）
            OutboxEvent event = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", Map.of(), "trace-001");

            // Act（执行）
            event.recordFailure("Kafka 连接超时", 5, 60L);

            // Assert（断言）
            assertThat(event.getStatus()).isEqualTo(OutboxEventStatus.FAILED);
            assertThat(event.getPublishAttempts()).isEqualTo(1);
            assertThat(event.getLastError()).isEqualTo("Kafka 连接超时");
            assertThat(event.getNextRetryAt()).isNotNull();
        }

        @Test
        @DisplayName("达到最大尝试次数时状态变为 DEAD_LETTER")
        void shouldTransitionToDeadLetterWhenMaxAttemptsReached() {
            // Arrange（准备）
            OutboxEvent event = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", Map.of(), "trace-001");

            // Act（执行）：模拟达到 maxAttempts
            event.recordFailure("err1", 1, 60L);

            // Assert（断言）
            assertThat(event.getStatus()).isEqualTo(OutboxEventStatus.DEAD_LETTER);
            assertThat(event.getPublishAttempts()).isEqualTo(1);
            assertThat(event.getNextRetryAt()).isNull();
        }

        @Test
        @DisplayName("连续失败应递增 attempts，直到 DEAD_LETTER")
        void shouldIncrementAttemptsOnRepeatedFailures() {
            // Arrange（准备）
            OutboxEvent event = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", Map.of(), "trace-001");

            // Act & Assert（执行 & 断言）：连续 3 次失败（未达上限 5）
            event.recordFailure("err-1", 5, 60L);
            assertThat(event.getStatus()).isEqualTo(OutboxEventStatus.FAILED);
            assertThat(event.getPublishAttempts()).isEqualTo(1);

            event.recordFailure("err-2", 5, 60L);
            assertThat(event.getStatus()).isEqualTo(OutboxEventStatus.FAILED);
            assertThat(event.getPublishAttempts()).isEqualTo(2);

            event.recordFailure("err-3", 5, 60L);
            assertThat(event.getStatus()).isEqualTo(OutboxEventStatus.FAILED);
            assertThat(event.getPublishAttempts()).isEqualTo(3);

            // 第 5 次达到上限
            event.recordFailure("err-4", 5, 60L);
            event.recordFailure("err-5", 5, 60L);
            assertThat(event.getStatus()).isEqualTo(OutboxEventStatus.DEAD_LETTER);
            assertThat(event.getPublishAttempts()).isEqualTo(5);
        }
    }
}
