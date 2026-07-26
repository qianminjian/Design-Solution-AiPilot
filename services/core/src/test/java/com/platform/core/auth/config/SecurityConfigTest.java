package com.platform.core.auth.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.core.auth.jwt.JwtTokenProvider;
import com.platform.core.common.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * {@link SecurityConfig} 单元测试
 *
 * <p>聚焦在可直接验证的 CORS 配置（security.md §7）与 SecurityConfig 实例化，
 * SecurityFilterChain 的完整端到端行为由集成测试覆盖。
 *
 * <p>验证点：
 * <ul>
 *   <li>CORS 白名单：仅允许配置的 origins，禁止 *</li>
 *   <li>允许的 HTTP 方法：GET/POST/PUT/PATCH/DELETE/OPTIONS</li>
 *   <li>exposed headers 包含 x-trace-id（traceId 跨服务传播）</li>
 *   <li>allowCredentials=true（refresh token cookie 需要）</li>
 *   <li>多 origins 配置（逗号分隔）应正确拆分</li>
 * </ul>
 */
@DisplayName("SecurityConfig 安全配置")
class SecurityConfigTest {

    private JwtTokenProvider jwtTokenProvider;
    private AppProperties appProperties;
    private ObjectMapper objectMapper;
    private SecurityConfig securityConfig;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = mock(JwtTokenProvider.class);
        objectMapper = new ObjectMapper();
        appProperties = new AppProperties();
        securityConfig = new SecurityConfig(jwtTokenProvider, appProperties, objectMapper);
    }

    /** 构造模拟请求，使 UrlBasedCorsConfigurationSource 能匹配 /** 并返回配置 */
    private static MockHttpServletRequest buildRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setServletPath("/api/v1/projects");
        request.setRequestURI("/api/v1/projects");
        return request;
    }

    private CorsConfiguration getCorsConfig() {
        CorsConfigurationSource source = securityConfig.corsConfigurationSource();
        return source.getCorsConfiguration(buildRequest());
    }

    @Nested
    @DisplayName("CORS 配置（security.md §7）")
    class CorsConfigurationTests {

        @Test
        @DisplayName("默认 CORS 应仅允许 localhost:3000")
        void defaultCorsShouldOnlyAllowLocalhost3000() {
            // Act
            CorsConfiguration config = getCorsConfig();

            // Assert
            assertThat(config).isNotNull();
            assertThat(config.getAllowedOrigins())
                    .containsExactly("http://localhost:3000");
        }

        @Test
        @DisplayName("CORS 不应包含 * 通配符（禁止 *）")
        void corsShouldNotContainWildcard() {
            // Arrange
            appProperties.getCors().setAllowedOrigins("http://localhost:3000,https://app.example.com");

            // Act
            CorsConfiguration config = getCorsConfig();

            // Assert
            // security.md §7：禁止 Access-Control-Allow-Origin: *
            assertThat(config.getAllowedOrigins()).doesNotContain("*");
        }

        @Test
        @DisplayName("多 origins 逗号分隔应正确拆分")
        void shouldParseMultipleOriginsByComma() {
            // Arrange
            appProperties.getCors().setAllowedOrigins(
                    "http://localhost:3000,https://app.example.com,https://admin.example.com"
            );

            // Act
            CorsConfiguration config = getCorsConfig();

            // Assert
            assertThat(config.getAllowedOrigins()).containsExactly(
                    "http://localhost:3000",
                    "https://app.example.com",
                    "https://admin.example.com"
            );
        }

        @Test
        @DisplayName("origins 逗号两侧空白应被 trim（首尾空白保留，由调用方控制）")
        void shouldTrimWhitespaceAroundComma() {
            // Arrange
            // AppProperties.Cors.allowedOriginsArray() 用 \\s*,\\s* 拆分
            // 仅 trim 逗号两侧空白，字符串首尾空白保留（不做整体 trim）
            appProperties.getCors().setAllowedOrigins(
                    "http://localhost:3000 , https://app.example.com"
            );

            // Act
            CorsConfiguration config = getCorsConfig();

            // Assert
            assertThat(config.getAllowedOrigins()).containsExactly(
                    "http://localhost:3000",
                    "https://app.example.com"
            );
        }

        @Test
        @DisplayName("允许的 HTTP 方法应包含 GET/POST/PUT/PATCH/DELETE/OPTIONS")
        void allowedMethodsShouldIncludeAllStandardMethods() {
            // Act
            CorsConfiguration config = getCorsConfig();

            // Assert
            assertThat(config.getAllowedMethods()).contains(
                    "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"
            );
        }

        @Test
        @DisplayName("exposed headers 应包含 x-trace-id")
        void exposedHeadersShouldContainTraceId() {
            // Act
            CorsConfiguration config = getCorsConfig();

            // Assert
            // api-conventions.md：traceId 跨服务传播通过 x-trace-id header
            assertThat(config.getExposedHeaders()).contains("x-trace-id");
        }

        @Test
        @DisplayName("allowedHeaders 应允许 *")
        void allowedHeadersShouldAllowAll() {
            // Act
            CorsConfiguration config = getCorsConfig();

            // Assert
            // allowedHeaders 设为 * 不违反安全规范（仅 allowedOrigins 禁止 *）
            assertThat(config.getAllowedHeaders()).contains("*");
        }

        @Test
        @DisplayName("allowCredentials 应为 true（refresh token cookie 必需）")
        void allowCredentialsShouldBeTrue() {
            // Act
            CorsConfiguration config = getCorsConfig();

            // Assert
            // security.md §2.2：refresh token 通过 httpOnly + SameSite=Strict cookie 携带
            // 需要 allowCredentials=true 才能跨域传递
            assertThat(config.getAllowCredentials()).isTrue();
        }

        @Test
        @DisplayName("maxAge 应为 3600 秒（1 小时预检缓存）")
        void maxAgeShouldBe3600Seconds() {
            // Act
            CorsConfiguration config = getCorsConfig();

            // Assert
            assertThat(config.getMaxAge()).isEqualTo(3600L);
        }
    }

    @Nested
    @DisplayName("配置注入与实例化")
    class Instantiation {

        @Test
        @DisplayName("应正确注入 JwtTokenProvider / AppProperties / ObjectMapper")
        void shouldInjectDependencies() {
            // Arrange & Act
            SecurityConfig config = new SecurityConfig(
                    jwtTokenProvider, appProperties, objectMapper
            );

            // Assert
            // 仅验证实例化不抛异常，依赖由 Spring 容器管理
            assertThat(config).isNotNull();
        }

        @Test
        @DisplayName("corsConfigurationSource 应返回非空 CorsConfigurationSource")
        void corsConfigurationSourceShouldReturnNonEmptySource() {
            // Act
            CorsConfigurationSource source = securityConfig.corsConfigurationSource();

            // Assert
            assertThat(source).isNotNull();
            // 全局配置 /** 都应能匹配
            assertThat(source.getCorsConfiguration(buildRequest())).isNotNull();
        }
    }

    @Nested
    @DisplayName("origins 边界场景")
    class OriginsEdgeCases {

        @Test
        @DisplayName("空字符串 origins 应返回空数组")
        void emptyOriginsShouldReturnEmptyArray() {
            // Arrange
            appProperties.getCors().setAllowedOrigins("");

            // Act
            CorsConfiguration config = getCorsConfig();

            // Assert
            // AppProperties.Cors.allowedOriginsArray() 处理空字符串返回空数组
            // CorsConfiguration.setAllowedOrigins 接受空 List
            assertThat(config.getAllowedOrigins()).isEmpty();
        }

        @Test
        @DisplayName("空白字符串 origins 应返回空数组")
        void blankOriginsShouldReturnEmptyArray() {
            // Arrange
            appProperties.getCors().setAllowedOrigins("   ");

            // Act
            CorsConfiguration config = getCorsConfig();

            // Assert
            assertThat(config.getAllowedOrigins()).isEmpty();
        }

        @Test
        @DisplayName("单一 origin 不带逗号应正确解析")
        void singleOriginWithoutCommaShouldParse() {
            // Arrange
            appProperties.getCors().setAllowedOrigins("https://app.example.com");

            // Act
            CorsConfiguration config = getCorsConfig();

            // Assert
            assertThat(config.getAllowedOrigins()).containsExactly("https://app.example.com");
        }
    }
}
