package com.platform.core.operations.connector.service;

import com.platform.core.operations.connector.repository.ConnectorStatusRepository;
import com.platform.core.operations.domain.enums.ConnectorHealthStatus;
import com.platform.core.operations.domain.enums.ConnectorType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * 连接器健康检查器（D37.17 §连接器 §健康检查）
 *
 * <p>V0 轻量实现（对齐 A-59 后端异步健康检查补齐）：
 * <ul>
 *   <li>{@link #checkAsync(UUID, ConnectorType, String, String)} 由 {@link ConnectorService#register}
 *       通过 @Async 异步触发，不阻塞注册主流程</li>
 *   <li>{@link ConnectorType#LLM}：HTTP GET {endpointUrl}/v1/models（DeepSeek/OpenAI 兼容端点），
 *       2xx → CONNECTED，4xx → DISCONNECTED（鉴权失败），5xx/超时/异常 → DEGRADED</li>
 *   <li>{@link ConnectorType#MINIO}：HTTP GET {endpointUrl}/minio/health/live，
 *       2xx → CONNECTED，其他 → DISCONNECTED</li>
 *   <li>{@link ConnectorType#AI_PROVIDER}：OD-05 V1 ManualHandoff 约束，跳过自动检查，保持 UNKNOWN</li>
 *   <li>{@link ConnectorType#REVIT}/{@link ConnectorType#RHINO}/{@link ConnectorType#SKETCHUP}：
 *       无标准健康检查端点，V0 跳过自动检查，保持 UNKNOWN（V1 接入 Worker 心跳后联动）</li>
 *   <li>endpointUrl 为空：记录日志说明"无法自动检查"，保持 UNKNOWN</li>
 *   <li>异常仅记录日志，不抛出（不影响注册主流程）</li>
 * </ul>
 *
 * <p>安全红线（OD-05 外部 AI V1 约束）：
 * <ul>
 *   <li>AI_PROVIDER 类型 V1 维持 ManualHandoff，不主动调用任何建筑 AI Provider API</li>
 *   <li>健康检查请求不携带 Authorization 头（V0 仅探测端点可达性，不调用付费 API）</li>
 *   <li>超时配置 5s 连接 + 5s 读取，避免长时间占用异步线程池</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17
 * @design D44-部署拓扑-Hybrid-Site.md
 * @design D42-AI-服务能力-清单.md
 */
@Component
public class ConnectorHealthChecker {

    private static final Logger log = LoggerFactory.getLogger(ConnectorHealthChecker.class);

    /** 健康检查超时（秒），短超时避免占用异步线程池 */
    private static final long HEALTH_CHECK_TIMEOUT_SECONDS = 5L;

    /** LLM 健康检查路径（DeepSeek/OpenAI 兼容） */
    private static final String LLM_HEALTH_PATH = "/v1/models";

    /** MinIO 健康检查路径 */
    private static final String MINIO_HEALTH_PATH = "/minio/health/live";

    private final ConnectorStatusRepository repository;
    private final RestClient healthCheckClient;

    public ConnectorHealthChecker(ConnectorStatusRepository repository) {
        this.repository = repository;
        // 构造独立的 RestClient 实例，短超时配置避免影响 aiRestClient Bean
        SimpleClientHttpRequestFactoryWithTimeout factory =
                new SimpleClientHttpRequestFactoryWithTimeout(HEALTH_CHECK_TIMEOUT_SECONDS);
        this.healthCheckClient = RestClient.builder()
                .requestFactory(factory)
                .build();
    }

    /**
     * 异步触发连接器健康检查
     *
     * <p>由 {@link ConnectorService#register} 在保存实体后调用，通过 @Async 在独立线程池执行。
     * 不抛出异常（仅记录日志），不影响注册主流程。
     *
     * @param tenantId 租户 ID
     * @param connectorId 连接器 ID（用于日志和数据库更新）
     * @param type 连接器类型
     * @param endpointUrl 端点 URL（可能为 null）
     * @param connectorCode 连接器业务编号（用于日志）
     */
    @Async("connectorHealthCheckExecutor")
    @Transactional
    public void checkAsync(
            UUID tenantId,
            UUID connectorId,
            ConnectorType type,
            String endpointUrl,
            String connectorCode) {
        try {
            ConnectorHealthStatus newStatus = doCheck(type, endpointUrl, connectorCode);
            updateConnectorStatus(tenantId, connectorId, newStatus);
            log.info("Connector health check completed: id={}, connectorCode={}, type={}, status={}, endpointUrl={}",
                    connectorId, connectorCode, type, newStatus, maskEndpointUrl(endpointUrl));
        } catch (Exception e) {
            // 兜底：异常不抛出，仅记录日志，状态保持 UNKNOWN（不更新）
            log.warn("Connector health check failed (silent fallback): id={}, connectorCode={}, type={}, reason={}",
                    connectorId, connectorCode, type, e.getMessage());
        }
    }

    /**
     * 执行健康检查策略分发
     *
     * @param type 连接器类型
     * @param endpointUrl 端点 URL
     * @param connectorCode 连接器业务编号（用于日志）
     * @return 检查后的健康状态
     */
    private ConnectorHealthStatus doCheck(
            ConnectorType type,
            String endpointUrl,
            String connectorCode) {
        // endpointUrl 为空：无法自动检查，保持 UNKNOWN
        if (endpointUrl == null || endpointUrl.isBlank()) {
            log.info("Connector health check skipped (no endpointUrl): connectorCode={}, type={}",
                    connectorCode, type);
            return ConnectorHealthStatus.UNKNOWN;
        }

        switch (type) {
            case LLM:
                return checkLlm(endpointUrl, connectorCode);
            case MINIO:
                return checkMinio(endpointUrl, connectorCode);
            case AI_PROVIDER:
                // OD-05 V1 ManualHandoff 约束：不主动调用建筑 AI Provider API
                log.info("Connector health check skipped (AI_PROVIDER ManualHandoff): connectorCode={}",
                        connectorCode);
                return ConnectorHealthStatus.UNKNOWN;
            case REVIT:
            case RHINO:
            case SKETCHUP:
                // 设计工具连接器无标准健康检查端点，V0 跳过（V1 接入 Worker 心跳后联动）
                log.info("Connector health check skipped (design tool, V1 TODO): connectorCode={}, type={}",
                        connectorCode, type);
                return ConnectorHealthStatus.UNKNOWN;
            default:
                log.warn("Connector health check skipped (unknown type): connectorCode={}, type={}",
                        connectorCode, type);
                return ConnectorHealthStatus.UNKNOWN;
        }
    }

    /**
     * LLM 健康检查：HTTP GET {endpointUrl}/v1/models
     *
     * <p>不携带 Authorization 头（V0 仅探测端点可达性，不调用付费 API）。
     * 响应 2xx → CONNECTED，4xx → DISCONNECTED（鉴权失败但端点可达），5xx/超时/异常 → DEGRADED。
     */
    private ConnectorHealthStatus checkLlm(String endpointUrl, String connectorCode) {
        String url = endpointUrl + LLM_HEALTH_PATH;
        try {
            HttpStatusCode statusCode = healthCheckClient.get()
                    .uri(url)
                    .retrieve()
                    .toBodilessEntity()
                    .getStatusCode();
            if (statusCode.is2xxSuccessful()) {
                return ConnectorHealthStatus.CONNECTED;
            } else if (statusCode.is4xxClientError()) {
                // 4xx 通常为鉴权失败，但端点可达 → DISCONNECTED
                log.info("LLM health check 4xx (auth required but endpoint reachable): connectorCode={}, status={}",
                        connectorCode, statusCode.value());
                return ConnectorHealthStatus.DISCONNECTED;
            } else {
                // 5xx 服务端错误 → DEGRADED
                log.info("LLM health check 5xx (service degraded): connectorCode={}, status={}",
                        connectorCode, statusCode.value());
                return ConnectorHealthStatus.DEGRADED;
            }
        } catch (RestClientException e) {
            log.warn("LLM health check failed (network error): connectorCode={}, url={}, reason={}",
                    connectorCode, maskEndpointUrl(url), e.getMessage());
            return ConnectorHealthStatus.DEGRADED;
        }
    }

    /**
     * MinIO 健康检查：HTTP GET {endpointUrl}/minio/health/live
     *
     * <p>MinIO 健康检查端点不需要鉴权，2xx → CONNECTED，其他 → DISCONNECTED。
     */
    private ConnectorHealthStatus checkMinio(String endpointUrl, String connectorCode) {
        String url = endpointUrl + MINIO_HEALTH_PATH;
        try {
            HttpStatusCode statusCode = healthCheckClient.get()
                    .uri(url)
                    .retrieve()
                    .toBodilessEntity()
                    .getStatusCode();
            if (statusCode.is2xxSuccessful()) {
                return ConnectorHealthStatus.CONNECTED;
            } else {
                log.info("MinIO health check non-2xx: connectorCode={}, status={}",
                        connectorCode, statusCode.value());
                return ConnectorHealthStatus.DISCONNECTED;
            }
        } catch (RestClientException e) {
            log.warn("MinIO health check failed (network error): connectorCode={}, url={}, reason={}",
                    connectorCode, maskEndpointUrl(url), e.getMessage());
            return ConnectorHealthStatus.DISCONNECTED;
        }
    }

    /**
     * 更新连接器健康状态到数据库
     *
     * <p>独立事务，避免与外层 register 事务冲突。
     * 仅更新 status 和 lastHealthCheckAt 字段，其他字段保持不变。
     */
    private void updateConnectorStatus(
            UUID tenantId,
            UUID connectorId,
            ConnectorHealthStatus newStatus) {
        repository.findByIdAndTenantId(connectorId, tenantId).ifPresent(entity -> {
            entity.setStatus(newStatus);
            entity.setLastHealthCheckAt(Instant.now());
            repository.save(entity);
        });
    }

    /**
     * 端点 URL 脱敏（仅保留 host:port，去除 path 用于日志输出）
     *
     * <p>对齐 security.md §3 日志脱敏规范，避免完整 endpointUrl 进入日志（可能含敏感路径）。
     */
    private String maskEndpointUrl(String endpointUrl) {
        if (endpointUrl == null || endpointUrl.isBlank()) {
            return "[empty]";
        }
        try {
            java.net.URI uri = java.net.URI.create(endpointUrl);
            String host = uri.getHost();
            int port = uri.getPort();
            return host != null
                    ? port > 0 ? host + ":" + port : host
                    : "[unparseable]";
        } catch (Exception e) {
            return "[unparseable]";
        }
    }

    /**
     * 简单的 HTTP 请求工厂（设置连接/读取超时）
     *
     * <p>使用独立内部类，避免依赖 SimpleClientHttpRequestFactory 的 setter 在 builder 中无法直接调用。
     */
    private static class SimpleClientHttpRequestFactoryWithTimeout
            extends SimpleClientHttpRequestFactory {
        SimpleClientHttpRequestFactoryWithTimeout(long timeoutSeconds) {
            setConnectTimeout((int) Duration.ofSeconds(timeoutSeconds).toMillis());
            setReadTimeout((int) Duration.ofSeconds(timeoutSeconds).toMillis());
        }
    }
}
