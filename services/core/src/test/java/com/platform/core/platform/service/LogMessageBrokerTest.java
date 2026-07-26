package com.platform.core.platform.service;

import com.platform.core.platform.domain.OutboxEvent;
import com.platform.core.platform.domain.OutboxEventStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

/**
 * LogMessageBroker 单元测试
 *
 * <p>验证默认消息 Broker 实现（仅记录日志）的核心行为：
 * <ul>
 *   <li>publish 不抛异常（即使事件字段为 null）</li>
 *   <li>publish 完整事件时正常记录</li>
 *   <li>publish 空负载时使用空 Map 兜底</li>
 *   <li>MessageBroker.BrokerPublishException 可被构造与传递</li>
 * </ul>
 */
class LogMessageBrokerTest {

    private final LogMessageBroker broker = new LogMessageBroker();

    @Test
    @DisplayName("publish 完整事件应该不抛异常并记录日志")
    void publishFullEventShouldNotThrow() {
        OutboxEvent event = buildOutboxEvent();

        assertDoesNotThrow(() -> broker.publish(event));
    }

    @Test
    @DisplayName("publish 多次调用应保持稳定（幂等模拟）")
    void publishMultipleTimesShouldBeStable() {
        OutboxEvent event = buildOutboxEvent();

        // 连续投递 3 次，均不应抛异常
        for (int i = 0; i < 3; i++) {
            assertDoesNotThrow(() -> broker.publish(event));
        }
    }

    @Test
    @DisplayName("publish 空负载事件应不抛异常（create 工厂方法已兜底空 Map）")
    void publishEventWithEmptyPayloadShouldNotThrow() {
        OutboxEvent event = OutboxEvent.create(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Aggregate",
                UUID.randomUUID(),
                1L,
                "TestEvent",
                null,
                "trace-001"
        );

        assertDoesNotThrow(() -> broker.publish(event));
    }

    @Test
    @DisplayName("MessageBroker.BrokerPublishException 应能携带消息与原因")
    void brokerPublishExceptionShouldCarryMessageAndCause() {
        Throwable cause = new RuntimeException("downstream error");
        MessageBroker.BrokerPublishException ex =
                new MessageBroker.BrokerPublishException("publish failed", cause);

        assertThat(ex.getMessage()).isEqualTo("publish failed");
        assertThat(ex.getCause()).isSameAs(cause);
    }

    @Test
    @DisplayName("MessageBroker.BrokerPublishException 仅消息构造应可用")
    void brokerPublishExceptionWithMessageOnly() {
        MessageBroker.BrokerPublishException ex =
                new MessageBroker.BrokerPublishException("timeout");

        assertThat(ex.getMessage()).isEqualTo("timeout");
        assertThat(ex.getCause()).isNull();
    }

    @Test
    @DisplayName("LogMessageBroker 应实现 MessageBroker 接口")
    void logMessageBrokerShouldImplementMessageBrokerInterface() {
        assertThat(broker).isInstanceOf(MessageBroker.class);
    }

    private OutboxEvent buildOutboxEvent() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", "测试项目");
        payload.put("status", "ACTIVE");
        OutboxEvent event = OutboxEvent.create(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Project",
                UUID.randomUUID(),
                1L,
                "ProjectCreated",
                payload,
                "trace-" + UUID.randomUUID()
        );
        // 验证初始状态：未发布
        assertThat(event.getStatus()).isEqualTo(OutboxEventStatus.PENDING);
        return event;
    }
}
