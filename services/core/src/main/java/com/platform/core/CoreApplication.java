package com.platform.core;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import com.platform.core.common.config.AppProperties;

/**
 * 核心业务服务启动类
 * 模块化单体架构，内部按领域分包（iam/portfolio/requirement/workflow/cde/ai）
 */
@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class CoreApplication {

    public static void main(String[] args) {
        SpringApplication.run(CoreApplication.class, args);
    }
}
