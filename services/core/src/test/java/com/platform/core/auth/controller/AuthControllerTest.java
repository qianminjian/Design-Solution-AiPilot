package com.platform.core.auth.controller;

import com.platform.core.auth.dto.AuthContext;
import com.platform.core.auth.dto.ChangePasswordRequest;
import com.platform.core.auth.dto.LoginRequest;
import com.platform.core.auth.dto.LoginResponse;
import com.platform.core.auth.dto.LogoutResponse;
import com.platform.core.auth.dto.RefreshTokenResponse;
import com.platform.core.auth.jwt.JwtTokenProvider;
import com.platform.core.auth.service.AuthService;
import com.platform.core.auth.util.CookieUtil;
import com.platform.core.common.response.ApiResponse;
import com.platform.core.iam.support.TenantResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 认证控制器单元测试
 *
 * 覆盖：登录、刷新 token、登出、获取当前用户、修改密码。
 */
@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthService authService;

    @Mock
    private TenantResolver tenantResolver;

    @Mock
    private CookieUtil cookieUtil;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private HttpServletRequest httpRequest;

    @Mock
    private HttpServletResponse httpResponse;

    private AuthController controller;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID principalId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new AuthController(authService, tenantResolver, cookieUtil, jwtTokenProvider);
    }

    @Test
    @DisplayName("POST /login 应该返回登录响应并设置 refresh token cookie")
    void loginShouldReturnResponseAndSetCookie() {
        // Arrange
        when(tenantResolver.resolveTenantId(httpRequest)).thenReturn(tenantId);
        when(jwtTokenProvider.getRefreshTokenExpiresInSeconds()).thenReturn(604800L);
        LoginRequest request = new LoginRequest("admin@example.com", "password123", false);
        LoginResponse response = buildLoginResponse();
        AuthService.LoginResult result = new AuthService.LoginResult(response, "refresh-token-abc");
        when(authService.login(eq(tenantId), eq(request))).thenReturn(result);

        // Act
        ResponseEntity<ApiResponse<LoginResponse>> responseEntity =
                controller.login(request, httpRequest, httpResponse);

        // Assert
        assertThat(responseEntity.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(responseEntity.getBody().data().principal().id()).isEqualTo(principalId);
        verify(cookieUtil).setRefreshTokenCookie(eq(httpResponse), eq("refresh-token-abc"), eq(604800L));
    }

    @Test
    @DisplayName("POST /refresh 应该调用 Service 刷新 token")
    void refreshShouldInvokeService() {
        // Arrange
        String refreshToken = "refresh-token-abc";
        RefreshTokenResponse response = new RefreshTokenResponse("new-access-token", 3600L, false);
        when(cookieUtil.getRefreshTokenFromCookie(httpRequest)).thenReturn(refreshToken);
        when(authService.refreshToken(eq(refreshToken))).thenReturn(response);

        // Act
        ApiResponse<RefreshTokenResponse> result = controller.refresh(httpRequest);

        // Assert
        assertThat(result.data().accessToken()).isEqualTo("new-access-token");
        verify(authService).refreshToken(eq(refreshToken));
    }

    @Test
    @DisplayName("POST /logout 应该调用 Service 登出并清除 cookie")
    void logoutShouldInvokeServiceAndClearCookie() {
        // Arrange
        String refreshToken = "refresh-token-abc";
        LogoutResponse response = new LogoutResponse(true);
        when(cookieUtil.getRefreshTokenFromCookie(httpRequest)).thenReturn(refreshToken);
        when(authService.logout(any(), eq(refreshToken))).thenReturn(response);

        // Act
        ApiResponse<LogoutResponse> result = controller.logout(null, httpRequest, httpResponse);

        // Assert
        assertThat(result.data().revoked()).isTrue();
        verify(cookieUtil).clearRefreshTokenCookie(httpResponse);
    }

    @Test
    @DisplayName("GET /me 应该返回当前认证上下文")
    void meShouldReturnAuthContext() {
        // Arrange
        AuthContext.PrincipalInfo principal = new AuthContext.PrincipalInfo(
                principalId, tenantId, "admin@example.com", "管理员", "USER",
                "ACTIVE", "zh-CN", "Asia/Shanghai");
        AuthContext.TenantInfo tenant = new AuthContext.TenantInfo(
                tenantId, "示例租户", "TENANT001", "AP-SOUTHEAST-1", "zh-CN");
        AuthContext.SessionInfo session = new AuthContext.SessionInfo(
                "session-001", java.time.Instant.now(), java.time.Instant.now().plusSeconds(3600));
        AuthContext context = new AuthContext(principal, tenant, List.of("ADMIN"), List.of(), session);
        when(authService.getAuthContext()).thenReturn(context);

        // Act
        ApiResponse<AuthContext> result = controller.me();

        // Assert
        assertThat(result.data().principal().id()).isEqualTo(principalId);
        verify(authService).getAuthContext();
    }

    @Test
    @DisplayName("POST /change-password 应该返回 204 状态码")
    void changePasswordShouldReturn204() {
        // Arrange
        ChangePasswordRequest request = new ChangePasswordRequest("oldPass", "newPass123");

        // Act
        ResponseEntity<ApiResponse<Void>> response = controller.changePassword(request);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(authService).changePassword(eq(request));
    }

    private LoginResponse buildLoginResponse() {
        LoginResponse.PrincipalInfo principal = new LoginResponse.PrincipalInfo(
                principalId, tenantId, "admin@example.com", "管理员", "USER",
                "ACTIVE", "zh-CN", "Asia/Shanghai");
        LoginResponse.TenantInfo tenant = new LoginResponse.TenantInfo(
                tenantId, "示例租户", "TENANT001", "AP-SOUTHEAST-1", "zh-CN");
        return new LoginResponse(principal, "access-token-abc", 3600L, true,
                tenant, List.of("ADMIN"), List.of("project:read"));
    }
}
