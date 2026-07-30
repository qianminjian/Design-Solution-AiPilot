package com.platform.core.auth.controller;

import com.platform.core.auth.dto.AuthContext;
import com.platform.core.auth.dto.ChangePasswordRequest;
import com.platform.core.auth.dto.LoginRequest;
import com.platform.core.auth.dto.LoginResponse;
import com.platform.core.auth.dto.LogoutRequest;
import com.platform.core.auth.dto.LogoutResponse;
import com.platform.core.auth.dto.RefreshTokenResponse;
import com.platform.core.auth.dto.StepUpTokenRequest;
import com.platform.core.auth.dto.StepUpTokenResponse;
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
 * - POST /step-up         申请 step-up token（已认证，危险动作二次认证）
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
     *
     * V0 回退：前端登录前无法携带 x-tenant-id，按邮箱反查租户
     * V1 阶段：接入正式认证流程后移除回退路径
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        UUID tenantId = tenantResolver.resolveTenantIdOptional(httpRequest);
        AuthService.LoginResult result;
        if (tenantId != null) {
            result = authService.login(tenantId, request);
        } else {
            // V0 回退：按邮箱反查租户（V1 移除）
            result = authService.loginWithoutTenant(request);
        }
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

    /**
     * 申请 step-up token（危险动作二次认证）
     *
     * <p>调用方：前端在执行 OperationsAction（HIGH/IRREVERSIBLE 风险等级）前调用本端点，
     * 用户输入当前密码后服务端签发短期 step-up token（5 分钟），后续 OperationsAction 请求
     * 携带此 token 才能执行危险动作。
     *
     * <p>安全约束（见 D40 §Step-up 认证 / security.md §12）：
     * <ul>
     *   <li>必须已登录（携带 access token）</li>
     *   <li>密码校验失败统一返回"密码错误"（防枚举）</li>
     *   <li>step-up token 短期有效（≤5 分钟），不存储在 cookie</li>
     * </ul>
     *
     * @design D40-信息-物理安全.md §Step-up 认证
     * @design D37-关键界面-交互状态.md §D37.17 危险动作
     */
    @PostMapping("/step-up")
    public ApiResponse<StepUpTokenResponse> stepUp(@Valid @RequestBody StepUpTokenRequest request) {
        StepUpTokenResponse response = authService.issueStepUpToken(request);
        return ApiResponse.success(response);
    }
}
