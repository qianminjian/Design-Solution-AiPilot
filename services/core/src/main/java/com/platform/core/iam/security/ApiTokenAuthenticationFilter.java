package com.platform.core.iam.security;

import com.platform.core.common.security.AuthenticatedPrincipal;
import com.platform.core.iam.service.ApiTokenAuthenticator;
import com.platform.core.iam.support.TenantContextHolder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * IAM API Token 认证过滤器（P0-16.1 Token 认证中间件）
 *
 * <p>职责：
 * <ul>
 *   <li>从 Authorization 头提取 Bearer token</li>
 *   <li>区分 JWT 与 PAT（Personal Access Token）</li>
 *   <li>PAT 格式（64 位十六进制）调用 {@link ApiTokenAuthenticator} 认证</li>
 *   <li>JWT 格式（含点分隔符）跳过，由 {@link com.platform.core.auth.security.JwtAuthenticationFilter} 处理</li>
 *   <li>认证成功注入 SecurityContext + TenantContextHolder</li>
 * </ul>
 *
 * <p>过滤器顺序：在 JwtAuthenticationFilter 之前执行。
 * <ul>
 *   <li>PAT 优先识别：64 位十六进制字符串无点分隔符</li>
 *   <li>JWT 由后续 JwtAuthenticationFilter 处理：xxx.yyy.zzz 格式</li>
 *   <li>两者互不干扰，用户可选择 JWT 会话认证或 PAT API 认证</li>
 * </ul>
 *
 * <p>安全红线（security.md §1 + §2.2）：
 * <ul>
 *   <li>明文 token 仅在认证时使用，不落日志、不存 DB</li>
 *   <li>认证失败不抛异常，清理上下文让 Security 链以匿名身份继续</li>
 *   <li>请求结束清理 TenantContextHolder + SecurityContext（防 ThreadLocal 内存泄漏）</li>
 * </ul>
 */
public class ApiTokenAuthenticationFilter extends OncePerRequestFilter implements Ordered {

    private static final Logger log = LoggerFactory.getLogger(ApiTokenAuthenticationFilter.class);

    /** Authorization 头前缀 */
    private static final String BEARER_PREFIX = "Bearer ";

    /** 过滤器顺序：在 JwtAuthenticationFilter（HIGHEST_PRECEDENCE + 20）之前，PAT 优先 */
    private static final int FILTER_ORDER = Ordered.HIGHEST_PRECEDENCE + 10;

    private final ApiTokenAuthenticator apiTokenAuthenticator;

    public ApiTokenAuthenticationFilter(ApiTokenAuthenticator apiTokenAuthenticator) {
        this.apiTokenAuthenticator = apiTokenAuthenticator;
    }

    @Override
    public int getOrder() {
        return FILTER_ORDER;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null && apiTokenAuthenticator.isValidPatFormat(token)) {
            try {
                authenticate(token);
            } catch (Exception ex) {
                log.debug("PAT 认证失败 traceId={} cause={}",
                        org.slf4j.MDC.get("traceId"), ex.getMessage());
                SecurityContextHolder.clearContext();
            }
        }
        try {
            chain.doFilter(request, response);
        } finally {
            // 清理 ThreadLocal，防内存泄漏（与 JwtAuthenticationFilter 一致）
            TenantContextHolder.clear();
            SecurityContextHolder.clearContext();
        }
    }

    /**
     * 从 Authorization 头提取 Bearer token
     */
    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            return null;
        }
        return header.substring(BEARER_PREFIX.length()).trim();
    }

    /**
     * 认证 PAT 并填充 SecurityContext + TenantContextHolder
     */
    private void authenticate(String plainToken) {
        apiTokenAuthenticator.authenticate(plainToken)
                .ifPresent(principal -> {
                    Authentication auth = new UsernamePasswordAuthenticationToken(
                            principal, null, java.util.List.of());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    TenantContextHolder.setTenantId(principal.tenantId());
                });
    }
}
