package com.platform.core.platform.service;

import com.platform.core.platform.domain.OutboxEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * 默认消息 Broker 实现（仅记录日志，不实际投递）
 *
 * <p>适用场景：
 * <ul>
 *   <li>本地开发环境（无 Kafka/RabbitMQ 依赖）</li>
 *   <li>CI 集成测试（验证 Outbox 状态机正确性，无需真实 Broker）</li>
 *   <li>V0 部署画像下的占位实现（Docker Compose 单机部署）</li>
 * </ul>
 *
 * <p>当生产环境引入真实 Broker 时，提供 {@link MessageBroker} Bean 即可覆盖本实现
 * （通过 {@code @Primary} 或 {@code @ConditionalOnMissingBean} 装配顺序控制）。
 *
 * <p>注意：本实现将事件序列化为 INFO 日志，包含 traceId 与 aggregateVersion，
 * 便于在本地调试时通过日志追踪事件流转。生产环境必须替换为真实 Broker。
 */
@Component
public class LogMessageBroker implements MessageBroker {

    private static final Logger log = LoggerFactory.getLogger(LogMessageBroker.class);

    @Override
    public void publish(OutboxEvent event) {
        // 仅记录日志，模拟投递成功
        // 真实 Broker 会将事件序列化为 Avro/Protobuf 并投递到 topic/queue
        log.info("[LogBroker] 事件投递 eventId={} eventType={} aggregateType={} aggregateId={} "
                        + "aggregateVersion={} traceId={} payload={}",
                event.getId(),
                event.getEventType(),
                event.getAggregateType(),
                event.getAggregateId(),
                event.getAggregateVersion(),
                event.getTraceId(),
                event.getPayload());
    }
}
