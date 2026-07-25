package com.platform.core.platform.service;

import com.platform.core.platform.domain.OutboxEvent;
import com.platform.core.platform.domain.OutboxEventStatus;
import com.platform.core.platform.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Outbox 事件发布调度器
 *
 * <p>权威源：@design/D34-数据-数据库.md §3 与 @design/D35-API-事件契约.md
 *
 * <p>核心职责：
 * <ul>
 *   <li>定时拉取 {@code platform.outbox_event} 表中 PENDING/FAILED 状态事件</li>
 *   <li>调用 {@link MessageBroker#publish} 投递到消息中间件</li>
 *   <li>根据投递结果更新事件状态（PUBLISHED / FAILED / DEAD_LETTER）</li>
 *   <li>多实例部署时通过 SKIP LOCKED 避免重复处理（见 {@link OutboxEventRepository#findPublishable}）</li>
 * </ul>
 *
 * <p>调度策略：
 * <ul>
 *   <li>固定延迟 10 秒（{@code platform.outbox.publish-delay-ms} 可配置）</li>
 *   <li>单批最多处理 50 条（{@code platform.outbox.batch-size} 可配置）</li>
 *   <li>最大重试 5 次（{@code platform.outbox.max-attempts} 可配置）</li>
 *   <li>失败后延迟 60 秒重试（{@code platform.outbox.retry-delay-seconds} 可配置）</li>
 * </ul>
 *
 * <p>事务边界：每条事件独立事务（{@code REQUIRES_NEW}），避免单条失败回滚整批。
 */
@Component
public class OutboxPublisherScheduler {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisherScheduler.class);

    private final OutboxEventRepository outboxRepository;
    private final OutboxEventPublisher eventPublisher;
    private final MessageBroker broker;

    @Value("${platform.outbox.batch-size:50}")
    private int batchSize;

    @Value("${platform.outbox.max-attempts:5}")
    private int maxAttempts;

    @Value("${platform.outbox.retry-delay-seconds:60}")
    private long retryDelaySeconds;

    public OutboxPublisherScheduler(OutboxEventRepository outboxRepository,
                                    OutboxEventPublisher eventPublisher,
                                    MessageBroker broker) {
        this.outboxRepository = outboxRepository;
        this.eventPublisher = eventPublisher;
        this.broker = broker;
    }

    /**
     * 定时拉取并发布 Outbox 事件
     *
     * <p>调度配置：上次执行完成后等待 10 秒再次执行（fixedDelay），
     * 启动后立即执行首次（initialDelay=5s 等待 Spring 上下文初始化完成）。
     */
    @Scheduled(fixedDelayString = "${platform.outbox.publish-delay-ms:10000}",
            initialDelayString = "${platform.outbox.initial-delay-ms:5000}")
    public void publishPendingEvents() {
        Pageable pageable = PageRequest.of(0, batchSize);
        Instant now = Instant.now();
        List<OutboxEvent> events = outboxRepository.findPublishable(
                OutboxEventStatus.PENDING, OutboxEventStatus.FAILED, now, pageable);

        if (events.isEmpty()) {
            return;
        }

        log.info("Outbox 调度器拉取到 {} 条待发布事件", events.size());
        int success = 0;
        int failed = 0;
        int deadLettered = 0;

        for (OutboxEvent event : events) {
            try {
                publishSingleEvent(event.getId());
                success++;
            } catch (DeadLetterException ex) {
                deadLettered++;
                log.error("Outbox 事件进入死信 eventId={} error={}",
                        event.getId(), ex.getMessage());
            } catch (Exception ex) {
                failed++;
                log.warn("Outbox 事件发布失败 eventId={} error={}",
                        event.getId(), ex.getMessage());
            }
        }

        log.info("Outbox 调度器完成本批处理 total={} success={} failed={} deadLettered={}",
                events.size(), success, failed, deadLettered);
    }

    /**
     * 在独立事务中发布单个事件
     *
     * <p>使用 {@code REQUIRES_NEW} 隔离每条事件的事务边界，
     * 单条失败不影响其他事件的处理。
     *
     * @param eventId 事件 ID
     * @throws DeadLetterException 事件达到最大重试次数，进入死信状态
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void publishSingleEvent(java.util.UUID eventId) {
        OutboxEvent event = outboxRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("事件不存在: " + eventId));

        try {
            broker.publish(event);
            eventPublisher.markPublished(eventId);
        } catch (MessageBroker.BrokerPublishException ex) {
            eventPublisher.recordFailure(eventId, ex.getMessage(),
                    maxAttempts, retryDelaySeconds);
            // 重新查询以判断当前状态
            OutboxEvent updated = outboxRepository.findById(eventId).orElse(event);
            if (updated.getStatus() == OutboxEventStatus.DEAD_LETTER) {
                throw new DeadLetterException(ex.getMessage(), ex);
            }
            throw ex;
        } catch (Exception ex) {
            // 非 Broker 异常（如序列化失败），同样记录并重试
            String error = "非预期异常: " + ex.getClass().getSimpleName() + ": " + ex.getMessage();
            eventPublisher.recordFailure(eventId, error,
                    maxAttempts, retryDelaySeconds);
            OutboxEvent updated = outboxRepository.findById(eventId).orElse(event);
            if (updated.getStatus() == OutboxEventStatus.DEAD_LETTER) {
                throw new DeadLetterException(error, ex);
            }
            throw ex;
        }
    }

    /**
     * 死信异常（事件达到最大重试次数）
     */
    private static class DeadLetterException extends RuntimeException {
        public DeadLetterException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
