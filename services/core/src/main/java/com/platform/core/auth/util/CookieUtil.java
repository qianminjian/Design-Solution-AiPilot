package com.platform.core.auth.util;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

/**
 * Cookie 工具
 *
 * 用于 refresh token 的安全传输（见 security.md §2.2）：
 * - httpOnly：禁止 JS 访问，防 XSS 窃取
 * - Secure：仅 HTTPS 传输（开发环境允许 HTTP）
 * - SameSite=Strict：防 CSRF
 * - Path=/api/v1/auth：限制 cookie 仅发送到认证端点
 */
@Component
public class CookieUtil {

    /** refresh token cookie 名称 */
    public static final String REFRESH_TOKEN_COOKIE = "refresh_token";

    /** cookie 路径：限制到认证端点，减少不必要传输 */
    private static final String COOKIE_PATH = "/api/v1/auth";

    /**
     * 设置 refresh token cookie
     *
     * @param response HTTP 响应
     * @param token    refresh token 值
     * @param maxAge   有效期（秒）
     */
    public void setRefreshTokenCookie(HttpServletResponse response, String token, long maxAge) {
        String cookieValue = String.format(
                "%s=%s; Path=%s; Max-Age=%d; HttpOnly; SameSite=Strict",
                REFRESH_TOKEN_COOKIE, token, COOKIE_PATH, maxAge);
        // 生产环境强制 HTTPS，开发环境（HTTP）不加 Secure
        if (isSecureEnabled()) {
            cookieValue += "; Secure";
        }
        response.addHeader("Set-Cookie", cookieValue);
    }

    /**
     * 清除 refresh token cookie（设为立即过期）
     */
    public void clearRefreshTokenCookie(HttpServletResponse response) {
        String cookieValue = String.format(
                "%s=; Path=%s; Max-Age=0; HttpOnly; SameSite=Strict",
                REFRESH_TOKEN_COOKIE, COOKIE_PATH);
        if (isSecureEnabled()) {
            cookieValue += "; Secure";
        }
        response.addHeader("Set-Cookie", cookieValue);
    }

    /**
     * 从请求 cookie 中读取 refresh token
     * 不存在时返回 null
     */
    public String getRefreshTokenFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (REFRESH_TOKEN_COOKIE.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    /**
     * 是否启用 Secure 标志
     * 通过 spring.profiles.active=prod 判断，开发环境（dev/default）不启用
     * 生产环境必须 HTTPS（见 security.md §2.1）
     */
    private boolean isSecureEnabled() {
        String profile = System.getProperty("spring.profiles.active", "default");
        return "prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile);
    }
}
