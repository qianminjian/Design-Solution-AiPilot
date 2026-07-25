package com.platform.core.platform.service;

import com.platform.core.platform.domain.OutboxEvent;

/**
 * 消息 Broker 抽象接口
 *
 * <p>权威源：@design/D34-数据-数据库.md §3 与 @design/D35-API-事件契约.md
 *
 * <p>V1 部署画像（OD-06）Hybrid-Site：云控制面 + 客户站点 Windows Worker。
 * 不同部署环境使用不同 Broker 实现：
 * <ul>
 *   <li>开发环境：{@link LogMessageBroker}（仅记录日志，不实际投递）</li>
 *   <li>云控制面：KafkaBroker（V2+ 接入）</li>
 *   <li>客户站点：RabbitMqBroker / Azure Service Bus（按租户配置）</li>
 * </ul>
 *
 * <p>所有实现必须保证：
 * <ul>
 *   <li>幂等性：同一事件多次投递不会产生副作用（基于 aggregateType+aggregateId+aggregateVersion 去重）</li>
 *   <li>失败可重试：抛出 {@link BrokerPublishException} 表示投递失败，由调度器记录并重试</li>
 *   <li>不阻塞调用方：同步实现必须设置超时（建议 5s），异步实现必须返回 CompletableFuture</li>
 * </ul>
 */
public interface MessageBroker {

    /**
     * 投递 Outbox 事件到 Broker
     *
     * @param event 待发布的 Outbox 事件（已包含负载、traceId 等元信息）
     * @throws BrokerPublishException 投递失败（调度器将递增 attempts 并重试）
     */
    void publish(OutboxEvent event);

    /**
     * Broker 异常（用于调度器识别投递失败）
     */
    class BrokerPublishException extends RuntimeException {
        public BrokerPublishException(String message, Throwable cause) {
            super(message, cause);
        }

        public BrokerPublishException(String message) {
            super(message);
        }
    }
}
