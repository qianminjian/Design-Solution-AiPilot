package com.platform.core.auth.service;

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
import com.platform.core.common.security.AuthenticatedPrincipal;
import com.platform.core.auth.token.RefreshTokenStore;
import com.platform.core.common.response.BusinessException;
import com.platform.core.common.response.ErrorCode;
import com.platform.core.iam.domain.AccessGrant;
import com.platform.core.iam.domain.Principal;
import com.platform.core.iam.domain.RoleBinding;
import com.platform.core.iam.domain.Tenant;
import com.platform.core.iam.repository.AccessGrantRepository;
import com.platform.core.iam.repository.PrincipalRepository;
import com.platform.core.iam.repository.RoleBindingRepository;
import com.platform.core.iam.repository.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 认证业务服务
 *
 * 职责：登录 / 刷新 token / 获取上下文 / 登出 / 修改密码
 *
 * 安全约束：
 * - 登录失败统一返回"邮箱或密码错误"（防枚举）
 * - 密码不打印到日志
 * - refresh token 通过 RefreshTokenStore 管理（rotation / allDevices 登出）
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    /** RoleBinding / AccessGrant 状态：ACTIVE */
    private static final String STATUS_ACTIVE = "ACTIVE";
    /** AccessGrant 效果：ALLOW */
    private static final String EFFECT_ALLOW = "ALLOW";

    /** 密码复杂度：至少 8 位，含字母 + 数字 */
    private static final Pattern PASSWORD_PATTERN =
            Pattern.compile("^(?=.*[A-Za-z])(?=.*\\d).{8,}$");

    private final PrincipalRepository principalRepository;
    private final TenantRepository tenantRepository;
    private final RoleBindingRepository roleBindingRepository;
    private final AccessGrantRepository accessGrantRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenStore refreshTokenStore;

    public AuthService(PrincipalRepository principalRepository,
                       TenantRepository tenantRepository,
                       RoleBindingRepository roleBindingRepository,
                       AccessGrantRepository accessGrantRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider,
                       RefreshTokenStore refreshTokenStore) {
        this.principalRepository = principalRepository;
        this.tenantRepository = tenantRepository;
        this.roleBindingRepository = roleBindingRepository;
        this.accessGrantRepository = accessGrantRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenStore = refreshTokenStore;
    }

    /**
     * 登录（携带 tenantId）
     *
     * 业务流程：
     * 1. 根据 tenantId + email 查找 Principal
     * 2. BCrypt 校验密码
     * 3. 查询角色绑定（status=ACTIVE）
     * 4. 生成 access token + refresh token
     * 5. 存储 refresh token
     * 6. 更新 lastLoginAt
     *
     * @param tenantId 租户 ID（由 Controller 从请求头解析）
     * @param request  登录请求
     * @return 登录响应（含 access token + refresh token 标记）
     */
    @Transactional
    public LoginResult login(UUID tenantId, LoginRequest request) {
        Principal principal = principalRepository
                .findByTenantIdAndEmailAndDeletedAtIsNull(tenantId, request.email())
                .orElseThrow(() -> badCredentials());

        return doLogin(principal, tenantId, request.password());
    }

    /**
     * 登录（不携带 tenantId，V0 回退路径）
     *
     * V0 阶段：前端登录前无法携带 x-tenant-id，按邮箱反查租户
     * V1 阶段：接入正式认证流程后移除，强制要求前端先解析租户
     *
     * 业务流程：
     * 1. 按 email 查找 Principal（取首个未软删记录）
     * 2. 校验主体存在
     * 3. 委托 doLogin 完成密码校验、token 生成、上下文构建
     *
     * @param request 登录请求
     * @return 登录响应（含 access token + refresh token 标记）
     */
    @Transactional
    public LoginResult loginWithoutTenant(LoginRequest request) {
        Principal principal = principalRepository
                .findFirstByEmailAndDeletedAtIsNull(request.email())
                .orElseThrow(() -> badCredentials());
        // 从 Principal 反查 tenantId
        UUID tenantId = principal.getTenantId();
        return doLogin(principal, tenantId, request.password());
    }

    /**
     * 登录核心逻辑：密码校验、token 生成、上下文构建
     * 由 login / loginWithoutTenant 共享
     */
    private LoginResult doLogin(Principal principal, UUID tenantId, String password) {
        if (principal.getPasswordHash() == null) {
            log.warn("主体未设置密码 principalId={}", principal.getId());
            throw badCredentials();
        }
        if (!passwordEncoder.matches(password, principal.getPasswordHash())) {
            log.warn("密码校验失败 principalId={}", principal.getId());
            throw badCredentials();
        }
        if (!STATUS_ACTIVE.equals(principal.getStatus())) {
            log.warn("主体状态非 ACTIVE principalId={} status={}", principal.getId(), principal.getStatus());
            throw badCredentials();
        }

        List<String> roles = loadRoles(tenantId, principal.getId());
        String accessToken = jwtTokenProvider.generateAccessToken(
                principal.getId(), tenantId, principal.getEmail(), roles);
        String refreshToken = jwtTokenProvider.generateRefreshToken(principal.getId(), tenantId);
        Instant refreshExpire = Instant.now()
                .plusSeconds(jwtTokenProvider.getRefreshTokenExpiresInSeconds());
        refreshTokenStore.store(refreshToken, principal.getId(), refreshExpire);

        principal.setLastLoginAt(Instant.now());
        principalRepository.save(principal);

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TENANT_NOT_FOUND,
                        HttpStatus.BAD_REQUEST, "租户不存在"));
        List<String> permissions = loadPermissions(tenantId, principal.getId());

        log.info("登录成功 tenantId={} principalId={}", tenantId, principal.getId());
        return new LoginResult(buildLoginResponse(principal, tenant, accessToken, roles, permissions),
                refreshToken);
    }

    /**
     * 刷新 access token
     *
     * V1 简化：refresh token 不轮换，仅颁发新 access token
     * V2 改为 rotation（旧 refresh token 失效，返回新 refresh token）
     *
     * @param refreshToken refresh token 字符串
     * @return 刷新响应（新 access token）
     */
    public RefreshTokenResponse refreshToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID, HttpStatus.UNAUTHORIZED,
                    "Refresh token 缺失");
        }
        jwtTokenProvider.validateToken(refreshToken);
        if (!JwtTokenProvider.TYPE_REFRESH.equals(jwtTokenProvider.getTokenType(refreshToken))) {
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID, HttpStatus.UNAUTHORIZED,
                    "Token 类型错误");
        }
        if (!refreshTokenStore.validate(refreshToken)) {
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID, HttpStatus.UNAUTHORIZED,
                    "Refresh token 已撤销");
        }

        UUID principalId = jwtTokenProvider.getPrincipalIdFromToken(refreshToken);
        UUID tenantId = jwtTokenProvider.getTenantIdFromToken(refreshToken);
        Principal principal = principalRepository.findById(principalId)
                .orElseThrow(() -> new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID,
                        HttpStatus.UNAUTHORIZED, "主体不存在"));
        if (!STATUS_ACTIVE.equals(principal.getStatus())) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED,
                    "主体已被禁用");
        }

        List<String> roles = loadRoles(tenantId, principalId);
        String newAccessToken = jwtTokenProvider.generateAccessToken(
                principalId, tenantId, principal.getEmail(), roles);

        log.info("刷新 token 成功 tenantId={} principalId={}", tenantId, principalId);
        return new RefreshTokenResponse(
                newAccessToken,
                jwtTokenProvider.getAccessTokenExpiresInSeconds(),
                true);
    }

    /**
     * 获取当前登录上下文
     * 从 SecurityContext 读取已认证信息，再补全 Principal/Tenant 详情
     */
    @Transactional(readOnly = true)
    public AuthContext getAuthContext() {
        AuthenticatedPrincipal auth = currentAuthenticated();
        Principal principal = principalRepository.findById(auth.principalId())
                .orElseThrow(() -> new BusinessException(ErrorCode.PRINCIPAL_NOT_FOUND,
                        HttpStatus.UNAUTHORIZED, "主体不存在"));
        Tenant tenant = tenantRepository.findById(auth.tenantId())
                .orElseThrow(() -> new BusinessException(ErrorCode.TENANT_NOT_FOUND,
                        HttpStatus.UNAUTHORIZED, "租户不存在"));
        List<String> roles = auth.roles() != null ? auth.roles() : loadRoles(auth.tenantId(), auth.principalId());
        List<String> permissions = loadPermissions(auth.tenantId(), auth.principalId());

        return new AuthContext(
                new AuthContext.PrincipalInfo(
                        principal.getId(), principal.getTenantId(), principal.getEmail(),
                        principal.getDisplayName(), principal.getType(), principal.getStatus(),
                        principal.getLocale(), principal.getTimezone()),
                new AuthContext.TenantInfo(
                        tenant.getId(), tenant.getName(), tenant.getCode(),
                        tenant.getRegion(), tenant.getLanguage()),
                roles, permissions,
                new AuthContext.SessionInfo(
                        auth.sessionId(), auth.issuedAt(), auth.expiresAt()));
    }

    /**
     * 登出
     *
     * V1 简化：
     * - 客户端清除 access token（无状态 JWT，服务端不存）
     * - 服务端撤销 refresh token
     * - allDevices=true 时撤销该主体所有 refresh token
     *
     * @param request         登出请求
     * @param refreshToken    从 cookie 读取的 refresh token
     * @return 登出响应
     */
    public LogoutResponse logout(LogoutRequest request, String refreshToken) {
        boolean allDevices = request != null && Boolean.TRUE.equals(request.allDevices());

        if (allDevices) {
            AuthenticatedPrincipal auth = currentAuthenticatedOrNull();
            if (auth != null) {
                refreshTokenStore.revokeAllForPrincipal(auth.principalId());
                log.info("登出所有设备 principalId={}", auth.principalId());
                return new LogoutResponse(true);
            }
        }
        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokenStore.revoke(refreshToken);
            log.info("登出单设备");
            return new LogoutResponse(true);
        }
        log.info("登出请求未携带 refresh token，仅客户端清理");
        return new LogoutResponse(true);
    }

    /**
     * 修改密码
     * 验证旧密码 → BCrypt 加密新密码 → 更新 passwordHash
     *
     * V1 简化：修改密码后不强制重新登录（access token 仍有效到过期）
     * V2 改为修改密码后撤销所有 refresh token（强制重新登录）
     */
    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        AuthenticatedPrincipal auth = currentAuthenticated();
        Principal principal = principalRepository.findById(auth.principalId())
                .orElseThrow(() -> new BusinessException(ErrorCode.PRINCIPAL_NOT_FOUND,
                        HttpStatus.UNAUTHORIZED, "主体不存在"));

        if (principal.getPasswordHash() == null
                || !passwordEncoder.matches(request.currentPassword(), principal.getPasswordHash())) {
            log.warn("修改密码：当前密码错误 principalId={}", auth.principalId());
            throw new BusinessException(ErrorCode.BAD_CREDENTIALS, HttpStatus.UNAUTHORIZED,
                    "当前密码错误");
        }
        if (!PASSWORD_PATTERN.matcher(request.newPassword()).matches()) {
            throw new BusinessException(ErrorCode.PASSWORD_POLICY_VIOLATION,
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "新密码必须至少 8 位且同时包含字母和数字");
        }
        principal.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        principalRepository.save(principal);
        log.info("修改密码成功 principalId={}", auth.principalId());
    }

    /**
     * 签发 step-up token（用于危险动作二次认证）
     *
     * <p>业务流程（见 D40 §Step-up 认证 / security.md §12）：
     * <ul>
     *   <li>1. 从 SecurityContext 读取当前认证主体（必须已登录）</li>
     *   <li>2. 校验当前密码正确（BCrypt 比对）</li>
     *   <li>3. 调用 JwtTokenProvider.generateStepUpToken 签发短期 token（5 分钟）</li>
     *   <li>4. 记录审计日志（principalId + purpose，不含密码）</li>
     *   <li>5. 返回 step-up token + expiresInSeconds + purpose</li>
     * </ul>
     *
     * <p>安全约束：
     * <ul>
     *   <li>校验失败统一返回"密码错误"（防枚举）</li>
     *   <li>密码不打印到日志</li>
     *   <li>step-up token 不存储在 RefreshTokenStore（无状态 JWT）</li>
     *   <li>principal 状态非 ACTIVE 拒绝签发</li>
     * </ul>
     *
     * @param request 二次认证请求（含密码 + 用途说明）
     * @return step-up token 响应（含 token + 有效期 + 用途）
     */
    public StepUpTokenResponse issueStepUpToken(StepUpTokenRequest request) {
        AuthenticatedPrincipal auth = currentAuthenticated();
        Principal principal = principalRepository.findById(auth.principalId())
                .orElseThrow(() -> new BusinessException(ErrorCode.PRINCIPAL_NOT_FOUND,
                        HttpStatus.UNAUTHORIZED, "主体不存在"));

        if (principal.getPasswordHash() == null
                || !passwordEncoder.matches(request.currentPassword(), principal.getPasswordHash())) {
            log.warn("Step-up 认证失败：密码错误 principalId={}", auth.principalId());
            throw new BusinessException(ErrorCode.BAD_CREDENTIALS, HttpStatus.UNAUTHORIZED,
                    "密码错误");
        }
        if (!STATUS_ACTIVE.equals(principal.getStatus())) {
            log.warn("Step-up 认证失败：主体状态非 ACTIVE principalId={} status={}",
                    auth.principalId(), principal.getStatus());
            throw new BusinessException(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED,
                    "主体已被禁用");
        }

        String stepUpToken = jwtTokenProvider.generateStepUpToken(
                auth.principalId(), auth.tenantId(), request.purpose());
        long expiresIn = jwtTokenProvider.getStepUpTokenExpiresInSeconds();

        log.info("Step-up token 签发成功 tenantId={} principalId={} purpose={}",
                auth.tenantId(), auth.principalId(), request.purpose());

        return new StepUpTokenResponse(stepUpToken, expiresIn, request.purpose());
    }

    // ── 内部辅助 ──

    /**
     * 构造统一文案的"邮箱或密码错误"业务异常
     * 防止通过不同返回信息枚举有效邮箱（见 security.md §12）
     */
    private BusinessException badCredentials() {
        return new BusinessException(ErrorCode.BAD_CREDENTIALS, HttpStatus.UNAUTHORIZED,
                "邮箱或密码错误");
    }

    /**
     * 加载主体角色代码列表（status=ACTIVE）
     */
    private List<String> loadRoles(UUID tenantId, UUID principalId) {
        return roleBindingRepository
                .findByTenantIdAndPrincipalIdAndStatus(tenantId, principalId, STATUS_ACTIVE)
                .stream()
                .map(RoleBinding::getRoleCode)
                .distinct()
                .toList();
    }

    /**
     * 加载主体权限列表（status=ACTIVE 且 effect=ALLOW）
     */
    private List<String> loadPermissions(UUID tenantId, UUID principalId) {
        return accessGrantRepository
                .findByTenantIdAndPrincipalIdAndStatus(tenantId, principalId, STATUS_ACTIVE)
                .stream()
                .filter(g -> EFFECT_ALLOW.equals(g.getEffect()))
                .map(AccessGrant::getPermission)
                .distinct()
                .toList();
    }

    /**
     * 构造登录响应
     */
    private LoginResponse buildLoginResponse(Principal principal, Tenant tenant,
                                             String accessToken, List<String> roles,
                                             List<String> permissions) {
        return new LoginResponse(
                new LoginResponse.PrincipalInfo(
                        principal.getId(), principal.getTenantId(), principal.getEmail(),
                        principal.getDisplayName(), principal.getType(), principal.getStatus(),
                        principal.getLocale(), principal.getTimezone()),
                accessToken,
                jwtTokenProvider.getAccessTokenExpiresInSeconds(),
                true,
                new LoginResponse.TenantInfo(
                        tenant.getId(), tenant.getName(), tenant.getCode(),
                        tenant.getRegion(), tenant.getLanguage()),
                roles, permissions);
    }

    /**
     * 从 SecurityContext 获取已认证主体
     * 未登录抛 401
     */
    private AuthenticatedPrincipal currentAuthenticated() {
        AuthenticatedPrincipal auth = currentAuthenticatedOrNull();
        if (auth == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED,
                    "未登录或 token 已失效");
        }
        return auth;
    }

    private AuthenticatedPrincipal currentAuthenticatedOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        Object principal = auth.getPrincipal();
        return principal instanceof AuthenticatedPrincipal ap ? ap : null;
    }

    /**
     * 登录结果
     * 包含响应 DTO + 原始 refresh token（用于设置 cookie）
     */
    public record LoginResult(LoginResponse response, String refreshToken) {
    }
}
