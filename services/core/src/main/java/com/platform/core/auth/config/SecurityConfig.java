package com.platform.core.auth.config;

import com.platform.core.auth.jwt.JwtTokenProvider;
import com.platform.core.auth.security.JwtAuthenticationFilter;
import com.platform.core.common.config.AppProperties;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.security.ApiTokenAuthenticationFilter;
import com.platform.core.iam.service.ApiTokenAuthenticator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Spring Security 配置
 *
 * 策略：
 * - 无状态会话（STATELESS），完全基于 JWT 或 PAT（P0-16.1）
 * - 禁用 CSRF（API 用 JWT/PAT，不需要 CSRF token）
 * - CORS 白名单（禁止 *，见 security.md §7）
 * - 公开端点：登录 / 刷新 token / 健康检查 / 主体注册
 * - 其他 /api/v1/** 端点需要认证
 * - ApiTokenAuthenticationFilter（PAT）在 JwtAuthenticationFilter 之前
 *   - PAT 优先识别（64 位十六进制字符串）
 *   - JWT 由后续 JwtAuthenticationFilter 处理（xxx.yyy.zzz 格式）
 *   - PAT 认证成功后 JwtAuthenticationFilter 跳过（检查 SecurityContext 已有 Authentication）
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final String[] PUBLIC_PATHS = {
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            "/health/**",
            "/actuator/health/**",
            "/actuator/info",
            "/error"
    };

    private final JwtTokenProvider jwtTokenProvider;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final ApiTokenAuthenticator apiTokenAuthenticator;

    public SecurityConfig(JwtTokenProvider jwtTokenProvider,
                          AppProperties appProperties,
                          ObjectMapper objectMapper,
                          ApiTokenAuthenticator apiTokenAuthenticator) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
        this.apiTokenAuthenticator = apiTokenAuthenticator;
    }

    /**
     * 安全过滤链
     *
     * <p>过滤器顺序（从前到后）：
     * <ol>
     *   <li>ApiTokenAuthenticationFilter（PAT 认证，64 位十六进制字符串）</li>
     *   <li>JwtAuthenticationFilter（JWT 认证，xxx.yyy.zzz 格式）</li>
     *   <li>UsernamePasswordAuthenticationFilter（Spring Security 默认）</li>
     * </ol>
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC_PATHS).permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/principals").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/v1/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint((request, response, ex) -> {
                            response.setStatus(HttpStatus.UNAUTHORIZED.value());
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.getWriter().write(unauthorizedJson());
                        }))
                // 注意顺序（Spring Security 6.2+ 要求锚点 filter 已注册）：
                // 1) 先注册 JwtAuthenticationFilter（锚定内置 UsernamePasswordAuthenticationFilter）
                // 2) 再以 JwtAuthenticationFilter 为锚点注册 ApiTokenAuthenticationFilter（PAT 优先）
                .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider),
                        UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(new ApiTokenAuthenticationFilter(apiTokenAuthenticator),
                        JwtAuthenticationFilter.class);
        return http.build();
    }

    /**
     * CORS 配置
     * 仅允许配置的 origins，禁止 *（security.md §7）
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(appProperties.getCors().allowedOriginsArray()));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("x-trace-id"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /**
     * 构造 401 响应 JSON（与 ApiResponse 格式一致）
     */
    private String unauthorizedJson() {
        try {
            ApiResponse<Void> body = ApiResponse.error(ErrorCode.UNAUTHORIZED, "未登录或 token 已失效");
            return objectMapper.writeValueAsString(body);
        } catch (Exception ex) {
            // 兜底：保证 401 响应不抛异常
            return "{\"code\":" + ErrorCode.UNAUTHORIZED + ",\"message\":\"未登录或 token 已失效\",\"traceId\":\""
                    + (MDC.get("traceId") != null ? MDC.get("traceId") : "") + "\"}";
        }
    }
}
