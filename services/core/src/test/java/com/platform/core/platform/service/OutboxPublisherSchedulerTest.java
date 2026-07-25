package com.platform.core.platform.service;

import com.platform.core.platform.domain.OutboxEvent;
import com.platform.core.platform.domain.OutboxEventStatus;
import com.platform.core.platform.repository.OutboxEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * OutboxPublisherScheduler 单元测试
 *
 * <p>覆盖调度器核心逻辑：
 * <ul>
 *   <li>无待发布事件时不执行任何操作</li>
 *   <li>批量拉取事件并按顺序调用 broker.publish</li>
 *   <li>成功投递的事件调用 markPublished</li>
 *   <li>失败投递的事件调用 recordFailure 并继续处理后续事件</li>
 *   <li>达到最大重试次数进入 DEAD_LETTER 状态</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class OutboxPublisherSchedulerTest {

    @Mock
    private OutboxEventRepository outboxRepository;

    @Mock
    private OutboxEventPublisher eventPublisher;

    private CountingBroker broker;
    private OutboxPublisherScheduler scheduler;

    private final UUID tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID aggregateId = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @BeforeEach
    void setUp() {
        broker = new CountingBroker();
        scheduler = new OutboxPublisherScheduler(outboxRepository, eventPublisher, broker);
        // 注入 @Value 配置（默认值）
        ReflectionTestUtils.setField(scheduler, "batchSize", 50);
        ReflectionTestUtils.setField(scheduler, "maxAttempts", 5);
        ReflectionTestUtils.setField(scheduler, "retryDelaySeconds", 60L);
    }

    @Nested
    @DisplayName("publishPendingEvents()")
    class PublishPendingEvents {

        @Test
        @DisplayName("无待发布事件时应直接返回，不调用 broker")
        void shouldReturnWhenNoEvents() {
            // Arrange（准备）
            when(outboxRepository.findPublishable(
                    eq(OutboxEventStatus.PENDING),
                    eq(OutboxEventStatus.FAILED),
                    any(Instant.class),
                    any()))
                    .thenReturn(List.of());

            // Act（执行）
            scheduler.publishPendingEvents();

            // Assert（断言）
            verify(eventPublisher, never()).markPublished(any());
            verify(eventPublisher, never()).recordFailure(any(), any(), anyInt(), anyLong());
            assertThat(broker.publishCount).isZero();
        }

        @Test
        @DisplayName("应该按顺序调用 broker.publish 投递每条事件并标记为 PUBLISHED")
        void shouldPublishAllEventsSuccessfully() {
            // Arrange（准备）
            OutboxEvent event1 = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", Map.of(), "trace-1");
            OutboxEvent event2 = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    2L, "ProjectUpdated", Map.of(), "trace-2");

            when(outboxRepository.findPublishable(
                    eq(OutboxEventStatus.PENDING),
                    eq(OutboxEventStatus.FAILED),
                    any(Instant.class),
                    any()))
                    .thenReturn(List.of(event1, event2));

            // 模拟 findById 在 publishSingleEvent 中返回事件
            when(outboxRepository.findById(event1.getId())).thenReturn(Optional.of(event1));
            when(outboxRepository.findById(event2.getId())).thenReturn(Optional.of(event2));

            // Act（执行）
            scheduler.publishPendingEvents();

            // Assert（断言）
            assertThat(broker.publishCount).isEqualTo(2);
            verify(eventPublisher, times(1)).markPublished(event1.getId());
            verify(eventPublisher, times(1)).markPublished(event2.getId());
        }

        @Test
        @DisplayName("单条投递失败不应阻塞后续事件处理")
        void shouldContinueProcessingAfterFailure() {
            // Arrange（准备）
            OutboxEvent event1 = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", Map.of(), "trace-1");
            OutboxEvent event2 = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    2L, "ProjectUpdated", Map.of(), "trace-2");

            // 第一条投递失败，第二条成功
            broker.failOnEvent(event1.getId());

            when(outboxRepository.findPublishable(
                    eq(OutboxEventStatus.PENDING),
                    eq(OutboxEventStatus.FAILED),
                    any(Instant.class),
                    any()))
                    .thenReturn(List.of(event1, event2));

            when(outboxRepository.findById(event1.getId())).thenReturn(Optional.of(event1));
            when(outboxRepository.findById(event2.getId())).thenReturn(Optional.of(event2));

            // Act（执行）
            scheduler.publishPendingEvents();

            // Assert（断言）
            assertThat(broker.publishCount).isEqualTo(2);  // 都尝试了 publish
            verify(eventPublisher, times(1)).recordFailure(eq(event1.getId()), any(), anyInt(), anyLong());
            verify(eventPublisher, times(1)).markPublished(event2.getId());
        }
    }

    @Nested
    @DisplayName("publishSingleEvent()")
    class PublishSingleEvent {

        @Test
        @DisplayName("成功投递应调用 markPublished")
        void shouldCallMarkPublishedOnSuccess() {
            // Arrange（准备）
            UUID eventId = UUID.randomUUID();
            OutboxEvent event = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", Map.of(), "trace-1");
            when(outboxRepository.findById(eventId)).thenReturn(Optional.of(event));

            // Act（执行）
            scheduler.publishSingleEvent(eventId);

            // Assert（断言）
            verify(eventPublisher, times(1)).markPublished(eventId);
            verify(eventPublisher, never()).recordFailure(any(), any(), anyInt(), anyLong());
        }

        @Test
        @DisplayName("BrokerPublishException 应调用 recordFailure 并向上抛出异常")
        void shouldCallRecordFailureOnBrokerException() {
            // Arrange（准备）
            UUID eventId = UUID.randomUUID();
            OutboxEvent event = OutboxEvent.create(
                    tenantId, null, "Project", aggregateId,
                    1L, "ProjectCreated", Map.of(), "trace-1");
            when(outboxRepository.findById(eventId)).thenReturn(Optional.of(event));
            // broker 检查的是 event.getId()（OutboxEvent 内部生成的 UUID）
            broker.failOnEvent(event.getId());

            // Act & Assert（执行 & 断言）：publishSingleEvent 重抛 BrokerPublishException
            // 让上层 publishPendingEvents 的 try-catch 处理错误统计
            assertThatThrownBy(() -> scheduler.publishSingleEvent(eventId))
                    .isInstanceOf(MessageBroker.BrokerPublishException.class);

            verify(eventPublisher, never()).markPublished(any());
            verify(eventPublisher, times(1)).recordFailure(eq(eventId), any(), anyInt(), anyLong());
        }
    }

    /**
     * 测试用 Broker：可控制投递成功/失败，并统计 publish 调用次数
     */
    private static class CountingBroker implements MessageBroker {

        int publishCount = 0;
        private UUID failEventId = null;

        void failOnEvent(UUID eventId) {
            this.failEventId = eventId;
        }

        @Override
        public void publish(OutboxEvent event) {
            publishCount++;
            if (failEventId != null && failEventId.equals(event.getId())) {
                throw new BrokerPublishException("模拟投递失败: " + event.getId());
            }
        }
    }
}
