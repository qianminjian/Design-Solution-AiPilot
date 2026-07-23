package com.platform.core.auth.controller;

import com.platform.core.auth.dto.AuthContext;
import com.platform.core.auth.dto.ChangePasswordRequest;
import com.platform.core.auth.dto.LoginRequest;
import com.platform.core.auth.dto.LoginResponse;
import com.platform.core.auth.dto.LogoutRequest;
import com.platform.core.auth.dto.LogoutResponse;
import com.platform.core.auth.dto.RefreshTokenResponse;
import com.platform.core.auth.jwt.JwtTokenProvider;
import com.platform.core.auth.service.AuthService;
import com.platform.core.auth.util.CookieUtil;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 认证 REST API
 * 路径：/api/v1/auth（见 packages/shared/src/contracts/auth.contract.ts §AuthApiPaths）
 *
 * 端点：
 * - POST /login           登录（公开）
 * - POST /logout          登出（已认证）
 * - POST /refresh         刷新 token（公开，refresh token 从 cookie 读取）
 * - GET  /me              获取当前用户信息（已认证）
 * - POST /change-password 修改密码（已认证）
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final TenantResolver tenantResolver;
    private final CookieUtil cookieUtil;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthController(AuthService authService,
                          TenantResolver tenantResolver,
                          CookieUtil cookieUtil,
                          JwtTokenProvider jwtTokenProvider) {
        this.authService = authService;
        this.tenantResolver = tenantResolver;
        this.cookieUtil = cookieUtil;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    /**
     * 登录
     * 成功后：
     * - 响应体返回 access token + principal/tenant/roles 信息
     * - refresh token 通过 httpOnly Cookie 设置
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        UUID tenantId = tenantResolver.resolveTenantId(httpRequest);
        AuthService.LoginResult result = authService.login(tenantId, request);
        cookieUtil.setRefreshTokenCookie(httpResponse, result.refreshToken(),
                jwtTokenProvider.getRefreshTokenExpiresInSeconds());
        return ResponseEntity.ok(ApiResponse.success(result.response()));
    }

    /**
     * 刷新 token
     * refresh token 从 httpOnly Cookie 读取
     * 返回新的 access token（refresh token V1 不轮换）
     */
    @PostMapping("/refresh")
    public ApiResponse<RefreshTokenResponse> refresh(HttpServletRequest httpRequest) {
        String refreshToken = cookieUtil.getRefreshTokenFromCookie(httpRequest);
        RefreshTokenResponse response = authService.refreshToken(refreshToken);
        return ApiResponse.success(response);
    }

    /**
     * 登出
     * 撤销 refresh token + 清除 cookie
     */
    @PostMapping("/logout")
    public ApiResponse<LogoutResponse> logout(
            @RequestBody(required = false) LogoutRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String refreshToken = cookieUtil.getRefreshTokenFromCookie(httpRequest);
        LogoutResponse response = authService.logout(request, refreshToken);
        cookieUtil.clearRefreshTokenCookie(httpResponse);
        return ApiResponse.success(response);
    }

    /**
     * 获取当前登录上下文
     */
    @GetMapping("/me")
    public ApiResponse<AuthContext> me() {
        return ApiResponse.success(authService.getAuthContext());
    }

    /**
     * 修改密码
     */
    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(request);
        return ResponseEntity.status(HttpStatus.NO_CONTENT)
                .body(ApiResponse.success(null, "密码修改成功"));
    }
}
