package com.platform.core.auth.security;

import com.platform.core.auth.jwt.JwtTokenProvider;
import com.platform.core.common.security.AuthenticatedPrincipal;
import com.platform.core.iam.support.TenantContextHolder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * JWT 认证过滤器
 *
 * 职责：
 * 1. 从 Authorization 头提取 Bearer token
 * 2. 验证 access token 签名与有效期
 * 3. 构建 Authentication 放入 SecurityContext
 * 4. 设置 TenantContextHolder（从 token 提取 tenant_id）
 * 5. 请求结束清理 TenantContextHolder（防 ThreadLocal 内存泄漏）
 *
 * 验证失败：不抛异常（让 Security 链后续拒绝），仅清理上下文
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    /** Authorization 头前缀 */
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider jwtTokenProvider;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        // P0-16.1：如果 PAT（ApiTokenAuthenticationFilter）已认证成功，跳过 JWT 认证
        // 避免覆盖 PAT 已设置的 SecurityContext
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            try {
                chain.doFilter(request, response);
            } finally {
                TenantContextHolder.clear();
                SecurityContextHolder.clearContext();
            }
            return;
        }

        String token = extractToken(request);
        if (token != null) {
            try {
                authenticate(token);
            } catch (Exception ex) {
                // 验证失败不抛异常，让 Security 链以匿名身份继续
                // 后续受保护资源会被 SecurityConfig 拒绝（401）
                log.debug("JWT 认证失败 traceId={} cause={}",
                        org.slf4j.MDC.get("traceId"), ex.getMessage());
                SecurityContextHolder.clearContext();
            }
        }
        try {
            chain.doFilter(request, response);
        } finally {
            // 清理 ThreadLocal，防内存泄漏（见 coding-standards.md）
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
     * 校验 token 并填充 SecurityContext + TenantContextHolder
     */
    private void authenticate(String token) {
        jwtTokenProvider.validateToken(token);
        if (!JwtTokenProvider.TYPE_ACCESS.equals(jwtTokenProvider.getTokenType(token))) {
            throw new IllegalArgumentException("Token 类型不是 access");
        }

        UUID principalId = jwtTokenProvider.getPrincipalIdFromToken(token);
        UUID tenantId = jwtTokenProvider.getTenantIdFromToken(token);
        String email = jwtTokenProvider.getEmailFromToken(token);
        List<String> roles = jwtTokenProvider.getRolesFromToken(token);
        String sessionId = jwtTokenProvider.getSessionIdFromToken(token);
        Instant issuedAt = jwtTokenProvider.getIssuedAtFromToken(token);
        Instant expiresAt = jwtTokenProvider.getExpiresAtFromToken(token);

        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
                principalId, tenantId, email, roles, sessionId, issuedAt, expiresAt);
        Authentication auth = new UsernamePasswordAuthenticationToken(
                principal, null, toAuthorities(roles));
        SecurityContextHolder.getContext().setAuthentication(auth);
        TenantContextHolder.setTenantId(tenantId);
    }

    /**
     * 角色代码 → Spring Security GrantedAuthority
     * 加 ROLE_ 前缀以便 @PreAuthorize("hasRole('xxx')") 使用
     */
    private static List<SimpleGrantedAuthority> toAuthorities(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return List.of();
        }
        return roles.stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                .collect(Collectors.toList());
    }
}
