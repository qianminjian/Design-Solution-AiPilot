package com.platform.core.common.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

/**
 * 异步线程池配置（A-60 显式 TaskExecutor）
 *
 * <p>对齐 A-59 V0 差距记录第④项："异步线程池配置（TaskExecutor）当前使用 Spring 默认配置，
 * V1.11+ 可考虑显式配置线程池大小和队列容量防止资源耗尽"。
 *
 * <p>Spring 默认使用 SimpleAsyncTaskExecutor，每次调用 @Async 方法都会创建新线程，
 * 无上限，无队列，无拒绝策略，高并发场景下会导致线程数飙升、内存耗尽、系统重启。
 *
 * <p>本配置定义两个 TaskExecutor Bean：
 * <ul>
 *   <li>{@link #platformAsyncExecutor()}：默认执行器，用于审计日志写入（AsyncAuditWriter）等
 *       通用异步任务</li>
 *   <li>{@link #connectorHealthCheckExecutor()}：连接器健康检查专用执行器，对齐 A-59
 *       ConnectorHealthChecker.checkAsync 异步触发需求</li>
 * </ul>
 *
 * <p>拒绝策略选择 CallerRunsPolicy（由调用线程执行）：
 * <ul>
 *   <li>原因：ConnectorHealthChecker.checkAsync 由 ConnectorService.register 调用，
 *       注册主流程已经返回响应给客户端，调用方线程执行被拒绝任务不会影响响应延迟</li>
 *   <li>副作用：调用方线程会执行额外的健康检查任务，但健康检查本身短超时（5s+5s），
 *       影响可控</li>
 *   <li>对比 AbortPolicy：拒绝任务会丢失健康检查（仅记录日志），CallerRuns 更保守</li>
 * </ul>
 *
 * <p>注意：本配置 Bean 不替代 @EnableAsync 注解（已在 {@link com.platform.core.CoreApplication} 启用），
 * 仅提供显式 TaskExecutor Bean，Spring 会自动将默认执行器替换为本配置的 Bean。
 *
 * <p>A-61 审计修复：已删除 asyncAnnotationBeanPostProcessor 冗余 Bean（Spring Boot 自动装配
 * 已覆盖 @Async 注解处理，重复注册无意义）。
 *
 * @design D37-关键界面-交互状态.md §D37.17（连接器健康检查异步触发）
 * @design backend-java.md（Spring Boot 3.4 构造器注入 + @Configuration + @Bean）
 * @design security.md §12 AI 安全红线（异步执行不阻塞主流程，异常仅记录日志）
 */
@Configuration
public class AsyncConfig {

    private static final Logger log = LoggerFactory.getLogger(AsyncConfig.class);

    /**
     * 默认异步执行器（platformAsyncExecutor）
     *
     * <p>用于 {@link com.platform.core.governance.auditlog.service.AsyncAuditWriter} 等
     * 通用异步任务，Bean 名为 "platformAsyncExecutor"。
     *
     * <p>对齐 backend-java.md：通过 @Bean(name="...") 显式命名 Bean，
     * 便于 @Async("platformAsyncExecutor") 精确指定。
     *
     * @param appProperties 应用配置（从 application.yml 加载 app.async.* 节点）
     * @return 配置好的 ThreadPoolTaskExecutor
     */
    @Bean(name = "platformAsyncExecutor")
    public ThreadPoolTaskExecutor platformAsyncExecutor(AppProperties appProperties) {
        AppProperties.Async asyncConfig = appProperties.getAsync();
        ThreadPoolTaskExecutor executor = buildExecutor(asyncConfig, "platform-async-");
        log.info("platformAsyncExecutor initialized: corePoolSize={}, maxPoolSize={}, queueCapacity={}, keepAlive={}s",
                asyncConfig.getCorePoolSize(),
                asyncConfig.getMaxPoolSize(),
                asyncConfig.getQueueCapacity(),
                asyncConfig.getKeepAliveSeconds());
        return executor;
    }

    /**
     * 连接器健康检查专用执行器（connectorHealthCheckExecutor）
     *
     * <p>用于 {@link com.platform.core.operations.connector.service.ConnectorHealthChecker#checkAsync}
     * 异步触发健康检查，Bean 名为 "connectorHealthCheckExecutor"。
     *
     * <p>对齐 A-59 健康检查需求：短超时（5s+5s） + 不阻塞主流程 + 异常不抛出。
     * 独立执行器隔离 ConnectorHealthChecker 与 AsyncAuditWriter 的线程池资源，
     * 防止健康检查异常任务耗尽通用异步线程池影响审计日志写入。
     *
     * @param appProperties 应用配置（从 application.yml 加载 app.async.* 节点）
     * @return 配置好的 ThreadPoolTaskExecutor
     */
    @Bean(name = "connectorHealthCheckExecutor")
    public ThreadPoolTaskExecutor connectorHealthCheckExecutor(AppProperties appProperties) {
        AppProperties.Async asyncConfig = appProperties.getAsync();
        ThreadPoolTaskExecutor executor = buildExecutor(asyncConfig, "connector-health-");
        log.info("connectorHealthCheckExecutor initialized: corePoolSize={}, maxPoolSize={}, queueCapacity={}, keepAlive={}s",
                asyncConfig.getCorePoolSize(),
                asyncConfig.getMaxPoolSize(),
                asyncConfig.getQueueCapacity(),
                asyncConfig.getKeepAliveSeconds());
        return executor;
    }

    /**
     * 构建 ThreadPoolTaskExecutor 通用方法
     *
     * <p>共享配置参数（来自 app.async.*）：
     * <ul>
     *   <li>corePoolSize：核心线程数</li>
     *   <li>maxPoolSize：最大线程数（队列满后才会创建至 maxPoolSize）</li>
     *   <li>queueCapacity：队列容量（核心线程满后任务进入队列等待）</li>
     *   <li>keepAliveSeconds：空闲线程保留秒数（超过核心线程数的空闲线程存活时间）</li>
     *   <li>threadNamePrefix：线程名前缀（每个 executor 不同，便于日志排查）</li>
     *   <li>rejectedExecutionHandler：CallerRunsPolicy（调用线程执行，避免任务丢失）</li>
     *   <li>waitForTasksToCompleteOnShutdown：true（等待任务完成再关闭，避免任务丢失）</li>
     *   <li>awaitTerminationSeconds：30s（等待 30s 后强制关闭，防止应用卡死）</li>
     * </ul>
     *
     * @param asyncConfig 异步配置
     * @param threadNamePrefix 线程名前缀（覆盖配置中的 threadNamePrefix，便于区分不同 executor）
     * @return 配置好的 ThreadPoolTaskExecutor
     */
    private ThreadPoolTaskExecutor buildExecutor(AppProperties.Async asyncConfig, String threadNamePrefix) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(asyncConfig.getCorePoolSize());
        executor.setMaxPoolSize(asyncConfig.getMaxPoolSize());
        executor.setQueueCapacity(asyncConfig.getQueueCapacity());
        executor.setKeepAliveSeconds(asyncConfig.getKeepAliveSeconds());
        executor.setThreadNamePrefix(threadNamePrefix);
        // 拒绝策略：调用线程执行（防止任务丢失，对齐 A-59 健康检查失败不影响主流程）
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        // 关闭时等待任务完成（避免健康检查任务被打断）
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        // 显式初始化（确保 Bean 创建时线程池已就绪，避免首次调用时延迟初始化）
        executor.initialize();
        return executor;
    }
}
