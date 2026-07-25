package com.platform.core;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

import com.platform.core.common.config.AppProperties;

/**
 * 核心业务服务启动类
 * 模块化单体架构，内部按领域分包（iam/portfolio/requirement/workflow/cde/ai）
 *
 * <p>启用 {@code @EnableScheduling} 以支持 OutboxPublisherScheduler 定时拉取事件。
 * 调度配置参数（{@code platform.outbox.*}）见 application.yml。
 */
@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
@EnableScheduling
public class CoreApplication {

    public static void main(String[] args) {
        SpringApplication.run(CoreApplication.class, args);
    }
}
