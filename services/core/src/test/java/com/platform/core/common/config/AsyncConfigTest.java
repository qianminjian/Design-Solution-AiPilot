package com.platform.core.common.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AsyncConfig 单元测试（A-60 显式 TaskExecutor 配置验证）
 *
 * <p>覆盖方法：
 * <ul>
 *   <li>{@link AsyncConfig#platformAsyncExecutor(AppProperties)}：默认执行器，用于 AsyncAuditWriter</li>
 *   <li>{@link AsyncConfig#connectorHealthCheckExecutor(AppProperties)}：连接器健康检查专用执行器</li>
 *   <li>{@link AsyncConfig#asyncAnnotationBeanPostProcessor(AppProperties)}：默认执行器配置</li>
 * </ul>
 *
 * <p>对齐 testing.md §4 Mock 规范：
 * <ul>
 *   <li>不需要 mock 外部依赖（纯配置类，无副作用）</li>
 *   <li>使用 AssertJ 断言库</li>
 *   <li>遵循 AAA 模式（Arrange/Act/Assert）</li>
 * </ul>
 *
 * @design D37-关键界面-交互状态.md §D37.17（连接器健康检查异步触发）
 * @design backend-java.md（Spring Boot 3.4 显式 TaskExecutor Bean）
 */
class AsyncConfigTest {

    private AsyncConfig asyncConfig;

    @BeforeEach
    void setUp() {
        asyncConfig = new AsyncConfig();
    }

    // ── platformAsyncExecutor ──

    @Test
    @DisplayName("platformAsyncExecutor：使用默认配置时应正确初始化线程池参数")
    void platformAsyncExecutor_shouldInitializeWithDefaultConfig() {
        // Arrange
        AppProperties appProperties = new AppProperties();
        // 默认配置：corePoolSize=2, maxPoolSize=4, queueCapacity=40, keepAliveSeconds=60

        // Act
        ThreadPoolTaskExecutor executor = asyncConfig.platformAsyncExecutor(appProperties);

        // Assert
        assertThat(executor).isNotNull();
        assertThat(executor.getCorePoolSize()).isEqualTo(2);
        assertThat(executor.getMaxPoolSize()).isEqualTo(4);
        assertThat(executor.getQueueCapacity()).isEqualTo(40);
        assertThat(executor.getKeepAliveSeconds()).isEqualTo(60);
        // 关键断言：线程名前缀为 "platform-async-"（buildExecutor 内部覆盖配置中的 threadNamePrefix）
        assertThat(executor.getThreadNamePrefix()).isEqualTo("platform-async-");
    }

    @Test
    @DisplayName("platformAsyncExecutor：自定义配置时应正确加载自定义值")
    void platformAsyncExecutor_shouldLoadCustomConfig() {
        // Arrange
        AppProperties appProperties = new AppProperties();
        AppProperties.Async asyncSettings = appProperties.getAsync();
        asyncSettings.setCorePoolSize(8);
        asyncSettings.setMaxPoolSize(16);
        asyncSettings.setQueueCapacity(160);
        asyncSettings.setKeepAliveSeconds(120);

        // Act
        ThreadPoolTaskExecutor executor = asyncConfig.platformAsyncExecutor(appProperties);

        // Assert
        assertThat(executor.getCorePoolSize()).isEqualTo(8);
        assertThat(executor.getMaxPoolSize()).isEqualTo(16);
        assertThat(executor.getQueueCapacity()).isEqualTo(160);
        assertThat(executor.getKeepAliveSeconds()).isEqualTo(120);
    }

    // ── connectorHealthCheckExecutor ──

    @Test
    @DisplayName("connectorHealthCheckExecutor：使用默认配置时应正确初始化线程池参数")
    void connectorHealthCheckExecutor_shouldInitializeWithDefaultConfig() {
        // Arrange
        AppProperties appProperties = new AppProperties();

        // Act
        ThreadPoolTaskExecutor executor = asyncConfig.connectorHealthCheckExecutor(appProperties);

        // Assert
        assertThat(executor).isNotNull();
        assertThat(executor.getCorePoolSize()).isEqualTo(2);
        assertThat(executor.getMaxPoolSize()).isEqualTo(4);
        assertThat(executor.getQueueCapacity()).isEqualTo(40);
        // 关键断言：线程名前缀为 "connector-health-"（独立于 platformAsyncExecutor，便于日志区分）
        assertThat(executor.getThreadNamePrefix()).isEqualTo("connector-health-");
    }

    @Test
    @DisplayName("connectorHealthCheckExecutor：与 platformAsyncExecutor 应是不同实例（线程池隔离）")
    void connectorHealthCheckExecutor_shouldBeDifferentInstanceFromPlatformAsyncExecutor() {
        // Arrange
        AppProperties appProperties = new AppProperties();

        // Act
        ThreadPoolTaskExecutor platformExecutor = asyncConfig.platformAsyncExecutor(appProperties);
        ThreadPoolTaskExecutor connectorExecutor = asyncConfig.connectorHealthCheckExecutor(appProperties);

        // Assert
        // 关键断言：两个 executor 是不同实例（避免健康检查任务耗尽通用异步线程池影响审计日志写入）
        assertThat(platformExecutor).isNotSameAs(connectorExecutor);
        // 线程名前缀也不同（便于日志排查时区分任务来源）
        assertThat(platformExecutor.getThreadNamePrefix()).isNotEqualTo(connectorExecutor.getThreadNamePrefix());
    }

    @Test
    @DisplayName("connectorHealthCheckExecutor：自定义配置时应正确加载自定义值")
    void connectorHealthCheckExecutor_shouldLoadCustomConfig() {
        // Arrange
        AppProperties appProperties = new AppProperties();
        AppProperties.Async asyncSettings = appProperties.getAsync();
        asyncSettings.setCorePoolSize(1);
        asyncSettings.setMaxPoolSize(2);
        asyncSettings.setQueueCapacity(20);

        // Act
        ThreadPoolTaskExecutor executor = asyncConfig.connectorHealthCheckExecutor(appProperties);

        // Assert
        assertThat(executor.getCorePoolSize()).isEqualTo(1);
        assertThat(executor.getMaxPoolSize()).isEqualTo(2);
        assertThat(executor.getQueueCapacity()).isEqualTo(20);
    }

    // ── AppProperties.Async 内部类 ──

    @Test
    @DisplayName("AppProperties.Async：默认值应符合单机 16GB 内存场景")
    void async_defaultValuesShouldFitLocal16GBMemory() {
        // Arrange + Act
        AppProperties.Async async = new AppProperties.Async();

        // Assert
        // 关键断言：默认值适配单机 16GB 内存（防 vm-compressor-space-shortage）
        // corePoolSize=2 + maxPoolSize=4 + queueCapacity=40 = 最多 44 个并发任务，远低于系统资源上限
        assertThat(async.getCorePoolSize()).isEqualTo(2);
        assertThat(async.getMaxPoolSize()).isEqualTo(4);
        assertThat(async.getQueueCapacity()).isEqualTo(40);
        assertThat(async.getKeepAliveSeconds()).isEqualTo(60);
        assertThat(async.getThreadNamePrefix()).isEqualTo("async-");
    }

    @Test
    @DisplayName("AppProperties.Async：setter 应正确更新字段值")
    void async_setterShouldUpdateFields() {
        // Arrange
        AppProperties.Async async = new AppProperties.Async();

        // Act
        async.setCorePoolSize(10);
        async.setMaxPoolSize(20);
        async.setQueueCapacity(200);
        async.setKeepAliveSeconds(300);
        async.setThreadNamePrefix("custom-async-");

        // Assert
        assertThat(async.getCorePoolSize()).isEqualTo(10);
        assertThat(async.getMaxPoolSize()).isEqualTo(20);
        assertThat(async.getQueueCapacity()).isEqualTo(200);
        assertThat(async.getKeepAliveSeconds()).isEqualTo(300);
        assertThat(async.getThreadNamePrefix()).isEqualTo("custom-async-");
    }

    @Test
    @DisplayName("AppProperties：getAsync 应返回非 null 默认实例")
    void appProperties_getAsyncShouldReturnNonNullDefaultInstance() {
        // Arrange + Act
        AppProperties appProperties = new AppProperties();

        // Assert
        // 关键断言：AppProperties 默认构造时已初始化 async 字段（非 null）
        assertThat(appProperties.getAsync()).isNotNull();
        assertThat(appProperties.getAsync().getCorePoolSize()).isEqualTo(2);
    }
}
