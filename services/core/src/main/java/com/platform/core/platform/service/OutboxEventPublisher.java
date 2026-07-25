package com.platform.core.platform.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.platform.domain.OutboxEvent;
import com.platform.core.platform.domain.OutboxEventStatus;
import com.platform.core.platform.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Outbox 事件发布器
 *
 * <p>权威源：@design/D34-数据-数据库.md §3 与 @design/D35-API-事件契约.md
 *
 * <p>核心职责：
 * <ul>
 *   <li>在聚合根事务内追加 Outbox 事件（同事务一致性，避免事件丢失）</li>
 *   <li>提供 {@link #publishEvent} 与 {@link #publishEventJson} 两种入口
 *       （前者使用 Map 负载，后者使用 JSON 字符串负载）</li>
 *   <li>消费者侧（{@link OutboxPublisherScheduler}）负责实际投递到 Broker</li>
 * </ul>
 *
 * <p>注意：调用方必须处于 {@code @Transactional} 上下文中，
 * 否则事件写入与聚合根状态变更不会在同一事务内提交。
 */
@Service
public class OutboxEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboxEventPublisher.class);

    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;

    public OutboxEventPublisher(OutboxEventRepository outboxRepository,
                                ObjectMapper objectMapper) {
        this.outboxRepository = outboxRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * 发布事件（Map 负载）
     *
     * @param tenantId         租户 ID
     * @param projectId        项目 ID（可空）
     * @param aggregateType    聚合根类型（如 "Project"）
     * @param aggregateId      聚合根 ID
     * @param aggregateVersion 聚合根版本号（乐观锁版本，用于消费者检测乱序）
     * @param eventType        事件类型（如 "ProjectCreated"）
     * @param payload          事件负载（必须为 JSON 可序列化对象）
     * @param traceId          追踪 ID（贯穿调用链，可空）
     * @return 已持久化的 Outbox 事件（状态为 PENDING）
     */
    @Transactional
    public OutboxEvent publishEvent(UUID tenantId,
                                    UUID projectId,
                                    String aggregateType,
                                    UUID aggregateId,
                                    Long aggregateVersion,
                                    String eventType,
                                    Map<String, Object> payload,
                                    String traceId) {
        if (tenantId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "tenantId 不能为空");
        }
        if (aggregateType == null || aggregateType.isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "aggregateType 不能为空");
        }
        if (aggregateId == null) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "aggregateId 不能为空");
        }
        if (aggregateVersion == null || aggregateVersion < 1) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "aggregateVersion 必须 >= 1");
        }
        if (eventType == null || eventType.isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_MISSING, "eventType 不能为空");
        }
        Map<String, Object> safePayload = payload != null ? payload : new LinkedHashMap<>();

        OutboxEvent event = OutboxEvent.create(
                tenantId, projectId, aggregateType, aggregateId,
                aggregateVersion, eventType, safePayload, traceId);
        OutboxEvent saved = outboxRepository.save(event);
        log.info("Outbox 事件已入队 tenantId={} aggregateType={} aggregateId={} eventType={} eventId={}",
                tenantId, aggregateType, aggregateId, eventType, saved.getId());
        return saved;
    }

    /**
     * 发布事件（JSON 字符串负载）
     *
     * <p>用于调用方已有 JSON 字符串的场景（如直接转发 BFF 请求体），避免重复序列化
     *
     * @param jsonPayload JSON 字符串负载
     * @see #publishEvent(UUID, UUID, String, UUID, Long, String, Map, String)
     */
    @Transactional
    public OutboxEvent publishEventJson(UUID tenantId,
                                        UUID projectId,
                                        String aggregateType,
                                        UUID aggregateId,
                                        Long aggregateVersion,
                                        String eventType,
                                        String jsonPayload,
                                        String traceId) {
        Map<String, Object> payload = parseJsonToMap(jsonPayload);
        return publishEvent(tenantId, projectId, aggregateType, aggregateId,
                aggregateVersion, eventType, payload, traceId);
    }

    /**
     * 将事件标记为已发布（由调度器调用）
     */
    @Transactional
    public void markPublished(UUID eventId) {
        OutboxEvent event = loadEventOrThrow(eventId);
        event.markPublished();
        outboxRepository.save(event);
        log.debug("Outbox 事件已发布 eventId={}", eventId);
    }

    /**
     * 记录发布失败并递增重试计数（由调度器调用）
     *
     * @param eventId           事件 ID
     * @param error             错误描述
     * @param maxAttempts       最大尝试次数（达到则进入死信）
     * @param retryDelaySeconds 下次重试延迟（秒）
     */
    @Transactional
    public void recordFailure(UUID eventId, String error, int maxAttempts, long retryDelaySeconds) {
        OutboxEvent event = loadEventOrThrow(eventId);
        event.recordFailure(error, maxAttempts, retryDelaySeconds);
        outboxRepository.save(event);
        if (event.getStatus() == OutboxEventStatus.DEAD_LETTER) {
            log.error("Outbox 事件进入死信 eventId={} attempts={} error={}",
                    eventId, event.getPublishAttempts(), error);
        } else {
            log.warn("Outbox 事件发布失败 eventId={} attempts={} error={}",
                    eventId, event.getPublishAttempts(), error);
        }
    }

    private OutboxEvent loadEventOrThrow(UUID eventId) {
        return outboxRepository.findById(eventId)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.OUTBOX_EVENT_NOT_FOUND,
                        "Outbox 事件不存在: " + eventId));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJsonToMap(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (JsonProcessingException ex) {
            log.error("Outbox 事件负载 JSON 解析失败", ex);
            throw new BusinessException(ErrorCode.PARAM_INVALID,
                    "Outbox 事件负载 JSON 解析失败: " + ex.getMessage());
        }
    }
}
