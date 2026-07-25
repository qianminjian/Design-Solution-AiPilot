package com.platform.core.platform.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.platform.domain.OutboxEvent;
import com.platform.core.platform.domain.OutboxEventStatus;
import com.platform.core.platform.repository.OutboxEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * OutboxEventPublisher 单元测试
 *
 * <p>覆盖核心业务规则：
 * <ul>
 *   <li>publishEvent 参数校验（tenantId/aggregateType/aggregateId/eventType 必填）</li>
 *   <li>publishEventJson 支持 JSON 字符串负载</li>
 *   <li>markPublished 调用领域方法并持久化</li>
 *   <li>recordFailure 调用领域方法并持久化</li>
 *   <li>事件不存在时抛出 OUTBOX_EVENT_NOT_FOUND</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class OutboxEventPublisherTest {

    @Mock
    private OutboxEventRepository outboxRepository;

    private OutboxEventPublisher publisher;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID aggregateId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private final UUID eventId = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @BeforeEach
    void setUp() {
        publisher = new OutboxEventPublisher(outboxRepository, new ObjectMapper());
    }

    @Nested
    @DisplayName("publishEvent()")
    class PublishEvent {

        @Test
        @DisplayName("应该创建 PENDING 状态事件并持久化")
        void shouldPersistPendingEvent() {
            // Arrange（准备）
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("name", "测试项目");
            when(outboxRepository.save(any(OutboxEvent.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            OutboxEvent result = publisher.publishEvent(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", payload, "trace-001");

            // Assert（断言）
            ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
            verify(outboxRepository).save(captor.capture());
            OutboxEvent saved = captor.getValue();

            assertThat(saved.getTenantId()).isEqualTo(tenantId);
            assertThat(saved.getAggregateType()).isEqualTo("Project");
            assertThat(saved.getAggregateId()).isEqualTo(aggregateId);
            assertThat(saved.getAggregateVersion()).isEqualTo(1L);
            assertThat(saved.getEventType()).isEqualTo("ProjectCreated");
            assertThat(saved.getStatus()).isEqualTo(OutboxEventStatus.PENDING);
            assertThat(saved.getPayload()).containsEntry("name", "测试项目");
            assertThat(saved.getTraceId()).isEqualTo("trace-001");

            assertThat(result).isSameAs(saved);
        }

        @Test
        @DisplayName("null payload 应使用空 Map 占位")
        void shouldHandleNullPayload() {
            // Arrange（准备）
            when(outboxRepository.save(any(OutboxEvent.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            OutboxEvent result = publisher.publishEvent(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", null, null);

            // Assert（断言）
            assertThat(result.getPayload()).isNotNull().isEmpty();
        }

        @Test
        @DisplayName("null tenantId 应抛出 PARAM_MISSING")
        void shouldThrowWhenTenantIdIsNull() {
            assertThatThrownBy(() -> publisher.publishEvent(
                    null, null, "Project", aggregateId,
                    1L, "ProjectCreated", Map.of(), null))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.PARAM_MISSING);
        }

        @Test
        @DisplayName("空白 aggregateType 应抛出 PARAM_MISSING")
        void shouldThrowWhenAggregateTypeIsBlank() {
            assertThatThrownBy(() -> publisher.publishEvent(
                    tenantId, null, "  ", aggregateId,
                    1L, "ProjectCreated", Map.of(), null))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.PARAM_MISSING);
        }

        @Test
        @DisplayName("null aggregateId 应抛出 PARAM_MISSING")
        void shouldThrowWhenAggregateIdIsNull() {
            assertThatThrownBy(() -> publisher.publishEvent(
                    tenantId, null, "Project", null,
                    1L, "ProjectCreated", Map.of(), null))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.PARAM_MISSING);
        }

        @Test
        @DisplayName("aggregateVersion < 1 应抛出 PARAM_OUT_OF_RANGE")
        void shouldThrowWhenAggregateVersionInvalid() {
            assertThatThrownBy(() -> publisher.publishEvent(
                    tenantId, null, "Project", aggregateId,
                    0L, "ProjectCreated", Map.of(), null))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.PARAM_OUT_OF_RANGE);
        }

        @Test
        @DisplayName("空白 eventType 应抛出 PARAM_MISSING")
        void shouldThrowWhenEventTypeIsBlank() {
            assertThatThrownBy(() -> publisher.publishEvent(
                    tenantId, null, "Project", aggregateId,
                    1L, "", Map.of(), null))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.PARAM_MISSING);
        }
    }

    @Nested
    @DisplayName("publishEventJson()")
    class PublishEventJson {

        @Test
        @DisplayName("应该解析 JSON 字符串并发布事件")
        void shouldParseJsonAndPublishEvent() {
            // Arrange（准备）
            String jsonPayload = "{\"name\":\"测试项目\",\"floors\":8}";
            when(outboxRepository.save(any(OutboxEvent.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            OutboxEvent result = publisher.publishEventJson(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", jsonPayload, "trace-001");

            // Assert（断言）
            assertThat(result.getPayload())
                    .containsEntry("name", "测试项目")
                    .containsEntry("floors", 8);
        }

        @Test
        @DisplayName("空白 JSON 字符串应使用空 Map 占位")
        void shouldHandleBlankJson() {
            // Arrange（准备）
            when(outboxRepository.save(any(OutboxEvent.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            OutboxEvent result = publisher.publishEventJson(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", "  ", null);

            // Assert（断言）
            assertThat(result.getPayload()).isNotNull().isEmpty();
        }

        @Test
        @DisplayName("非法 JSON 应抛出 PARAM_INVALID")
        void shouldThrowWhenJsonInvalid() {
            assertThatThrownBy(() -> publisher.publishEventJson(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", "{invalid json", null))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.PARAM_INVALID);
        }
    }

    @Nested
    @DisplayName("markPublished()")
    class MarkPublished {

        @Test
        @DisplayName("应该将事件标记为 PUBLISHED 并持久化")
        void shouldMarkEventAsPublished() {
            // Arrange（准备）
            OutboxEvent event = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", Map.of(), "trace-001");
            when(outboxRepository.findById(eventId)).thenReturn(Optional.of(event));
            when(outboxRepository.save(any(OutboxEvent.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            publisher.markPublished(eventId);

            // Assert（断言）
            verify(outboxRepository).save(any(OutboxEvent.class));
            assertThat(event.getStatus()).isEqualTo(OutboxEventStatus.PUBLISHED);
            assertThat(event.getPublishedAt()).isNotNull();
        }

        @Test
        @DisplayName("事件不存在应抛出 OUTBOX_EVENT_NOT_FOUND")
        void shouldThrowWhenEventNotFound() {
            // Arrange（准备）
            when(outboxRepository.findById(eventId)).thenReturn(Optional.empty());

            // Act & Assert（执行 & 断言）
            assertThatThrownBy(() -> publisher.markPublished(eventId))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.OUTBOX_EVENT_NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("recordFailure()")
    class RecordFailure {

        @Test
        @DisplayName("应该递增尝试次数并持久化")
        void shouldIncrementAttemptsAndPersist() {
            // Arrange（准备）
            OutboxEvent event = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", Map.of(), "trace-001");
            when(outboxRepository.findById(eventId)).thenReturn(Optional.of(event));
            when(outboxRepository.save(any(OutboxEvent.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）
            publisher.recordFailure(eventId, "Kafka 超时", 5, 60L);

            // Assert（断言）
            verify(outboxRepository).save(any(OutboxEvent.class));
            assertThat(event.getStatus()).isEqualTo(OutboxEventStatus.FAILED);
            assertThat(event.getPublishAttempts()).isEqualTo(1);
            assertThat(event.getLastError()).isEqualTo("Kafka 超时");
            assertThat(event.getNextRetryAt()).isNotNull();
        }

        @Test
        @DisplayName("达到最大尝试次数应进入 DEAD_LETTER 状态")
        void shouldTransitionToDeadLetterWhenMaxAttemptsReached() {
            // Arrange（准备）
            OutboxEvent event = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", Map.of(), "trace-001");
            when(outboxRepository.findById(eventId)).thenReturn(Optional.of(event));
            when(outboxRepository.save(any(OutboxEvent.class)))
                    .thenAnswer(inv -> inv.getArgument(0));

            // Act（执行）：maxAttempts=1，单次失败即进入死信
            publisher.recordFailure(eventId, "持续失败", 1, 60L);

            // Assert（断言）
            assertThat(event.getStatus()).isEqualTo(OutboxEventStatus.DEAD_LETTER);
            assertThat(event.getPublishAttempts()).isEqualTo(1);
            assertThat(event.getNextRetryAt()).isNull();
        }

        @Test
        @DisplayName("事件不存在应抛出 OUTBOX_EVENT_NOT_FOUND")
        void shouldThrowWhenEventNotFound() {
            // Arrange（准备）
            when(outboxRepository.findById(eventId)).thenReturn(Optional.empty());

            // Act & Assert（执行 & 断言）
            assertThatThrownBy(() -> publisher.recordFailure(eventId, "err", 5, 60L))
                    .isInstanceOf(BusinessException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.OUTBOX_EVENT_NOT_FOUND);
        }
    }
}
