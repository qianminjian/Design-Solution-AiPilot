package com.platform.core.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * RestClient 配置
 *
 * <p>Core Service 调用 AI Service 的 HTTP 客户端，使用 Spring Boot 3.4+ RestClient。
 * 超时从 AppProperties.AiService 读取，支持 reasoning 模型（如 deepseek-v4-pro，120s）。
 */
@Configuration
public class RestClientConfig {

    /**
     * 配置 RestClient Bean，供 AiImpactAnalyzer 等服务使用
     */
    @Bean
    public RestClient aiRestClient(AppProperties appProperties) {
        AppProperties.AiService aiConfig = appProperties.getAiService();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(10).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(aiConfig.getTimeoutSeconds()).toMillis());

        return RestClient.builder()
                .requestFactory(factory)
                .build();
    }
}
