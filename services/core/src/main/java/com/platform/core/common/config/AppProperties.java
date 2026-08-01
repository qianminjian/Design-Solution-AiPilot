package com.platform.core.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 应用配置属性
 * 从 application.yml 的 app.* 节点加载
 */
@Configuration
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String name;
    private String version;
    private String timezone;
    private Security security = new Security();
    private Cors cors = new Cors();
    private ObjectStorage objectStorage = new ObjectStorage();
    private AiService aiService = new AiService();
    /** 异步线程池配置（A-60 显式 TaskExecutor，对齐 A-59 健康检查异步执行需求） */
    private Async async = new Async();

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public Security getSecurity() {
        return security;
    }

    public void setSecurity(Security security) {
        this.security = security;
    }

    public ObjectStorage getObjectStorage() {
        return objectStorage;
    }

    public void setObjectStorage(ObjectStorage objectStorage) {
        this.objectStorage = objectStorage;
    }

    public Cors getCors() {
        return cors;
    }

    public void setCors(Cors cors) {
        this.cors = cors;
    }

    public AiService getAiService() {
        return aiService;
    }

    public void setAiService(AiService aiService) {
        this.aiService = aiService;
    }

    public Async getAsync() {
        return async;
    }

    public void setAsync(Async async) {
        this.async = async;
    }

    public static class Security {
        private String jwtSecret;
        private String accessTokenExpire;
        private String refreshTokenExpire;
        /** step-up token 有效期（默认 5m，security.md §12 / D40 §Step-up 认证） */
        private String stepUpTokenExpire;

        public String getJwtSecret() {
            return jwtSecret;
        }

        public void setJwtSecret(String jwtSecret) {
            this.jwtSecret = jwtSecret;
        }

        public String getAccessTokenExpire() {
            return accessTokenExpire;
        }

        public void setAccessTokenExpire(String accessTokenExpire) {
            this.accessTokenExpire = accessTokenExpire;
        }

        public String getRefreshTokenExpire() {
            return refreshTokenExpire;
        }

        public void setRefreshTokenExpire(String refreshTokenExpire) {
            this.refreshTokenExpire = refreshTokenExpire;
        }

        public String getStepUpTokenExpire() {
            return stepUpTokenExpire;
        }

        public void setStepUpTokenExpire(String stepUpTokenExpire) {
            this.stepUpTokenExpire = stepUpTokenExpire;
        }
    }

    public static class ObjectStorage {
        private String endpoint;
        private String accessKey;
        private String secretKey;
        private String bucket;
        private String region;

        public String getEndpoint() {
            return endpoint;
        }

        public void setEndpoint(String endpoint) {
            this.endpoint = endpoint;
        }

        public String getAccessKey() {
            return accessKey;
        }

        public void setAccessKey(String accessKey) {
            this.accessKey = accessKey;
        }

        public String getSecretKey() {
            return secretKey;
        }

        public void setSecretKey(String secretKey) {
            this.secretKey = secretKey;
        }

        public String getBucket() {
            return bucket;
        }

        public void setBucket(String bucket) {
            this.bucket = bucket;
        }

        public String getRegion() {
            return region;
        }

        public void setRegion(String region) {
            this.region = region;
        }
    }

    /**
     * CORS 跨域配置
     * 默认仅允许 BFF 域，禁止 *（见 security.md §7）
     */
    public static class Cors {
        /** 允许的来源列表（逗号分隔），从 app.cors.allowed-origins 读取 */
        private String allowedOrigins = "http://localhost:3000";

        public String getAllowedOrigins() {
            return allowedOrigins;
        }

        public void setAllowedOrigins(String allowedOrigins) {
            this.allowedOrigins = allowedOrigins;
        }

        /**
         * 将逗号分隔的 origins 字符串拆为数组
         */
        public String[] allowedOriginsArray() {
            if (allowedOrigins == null || allowedOrigins.isBlank()) {
                return new String[0];
            }
            return allowedOrigins.split("\\s*,\\s*");
        }
    }

    /**
     * AI Service 调用配置（V1.8 Sprint AI 辅助影响分析）
     *
     * <p>Core Service 通过 RestClient 调用 AI Service 的 text-generation 端点，
     * 自动生成变更影响分析内容（design-constraints.md §AI 安全红线）。
     *
     * <p>环境变量映射：
     * <ul>
     *   <li>{@code AI_SERVICE_URL} → app.ai-service.base-url</li>
     *   <li>{@code AI_TIMEOUT_SECONDS} → app.ai-service.timeout-seconds</li>
     * </ul>
     */
    public static class AiService {
        /** AI Service 基础 URL，如 http://aidesign-ai:8000 */
        private String baseUrl = "http://localhost:8000";

        /** LLM 调用超时（秒），reasoning 模型建议 120s */
        private int timeoutSeconds = 120;

        /** 调用失败重试次数（不含首次调用） */
        private int retryAttempts = 1;

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public int getTimeoutSeconds() {
            return timeoutSeconds;
        }

        public void setTimeoutSeconds(int timeoutSeconds) {
            this.timeoutSeconds = timeoutSeconds;
        }

        public int getRetryAttempts() {
            return retryAttempts;
        }

        public void setRetryAttempts(int retryAttempts) {
            this.retryAttempts = retryAttempts;
        }
    }

    /**
     * 异步线程池配置（A-60 显式 TaskExecutor）
     *
     * <p>对齐 A-59 V0 差距记录第④项："异步线程池配置（TaskExecutor）当前使用 Spring 默认配置，
     * V1.11+ 可考虑显式配置线程池大小和队列容量防止资源耗尽"。
     *
     * <p>本配置用于 ConnectorHealthChecker.checkAsync 等 @Async 方法，避免使用 Spring 默认
     * SimpleAsyncTaskExecutor（每次创建新线程，无上限，可能导致资源耗尽）。
     *
     * <p>环境变量映射：
     * <ul>
     *   <li>{@code ASYNC_CORE_POOL_SIZE} → app.async.core-pool-size</li>
     *   <li>{@code ASYNC_MAX_POOL_SIZE} → app.async.max-pool-size</li>
     *   <li>{@code ASYNC_QUEUE_CAPACITY} → app.async.queue-capacity</li>
     *   <li>{@code ASYNC_THREAD_NAME_PREFIX} → app.async.thread-name-prefix</li>
     *   <li>{@code ASYNC_KEEP_ALIVE_SECONDS} → app.async.keep-alive-seconds</li>
     * </ul>
     */
    public static class Async {
        /** 核心线程数（即使空闲也保留的线程数，建议 = CPU 核数） */
        private int corePoolSize = 2;

        /** 最大线程数（队列满后才会创建至 maxPoolSize，建议 = CPU 核数 × 2） */
        private int maxPoolSize = 4;

        /** 队列容量（核心线程满后任务进入队列等待，建议 = maxPoolSize × 10） */
        private int queueCapacity = 40;

        /** 线程名前缀（便于日志排查与 jstack 分析） */
        private String threadNamePrefix = "async-";

        /** 空闲线程保留秒数（超过核心线程数的空闲线程存活时间） */
        private int keepAliveSeconds = 60;

        public int getCorePoolSize() {
            return corePoolSize;
        }

        public void setCorePoolSize(int corePoolSize) {
            this.corePoolSize = corePoolSize;
        }

        public int getMaxPoolSize() {
            return maxPoolSize;
        }

        public void setMaxPoolSize(int maxPoolSize) {
            this.maxPoolSize = maxPoolSize;
        }

        public int getQueueCapacity() {
            return queueCapacity;
        }

        public void setQueueCapacity(int queueCapacity) {
            this.queueCapacity = queueCapacity;
        }

        public String getThreadNamePrefix() {
            return threadNamePrefix;
        }

        public void setThreadNamePrefix(String threadNamePrefix) {
            this.threadNamePrefix = threadNamePrefix;
        }

        public int getKeepAliveSeconds() {
            return keepAliveSeconds;
        }

        public void setKeepAliveSeconds(int keepAliveSeconds) {
            this.keepAliveSeconds = keepAliveSeconds;
        }
    }
}
