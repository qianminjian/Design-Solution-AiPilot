/**
 * 认证域 API 契约
 * 权威源：@design/D39-身份多租户-授权.md §D39.7 + @design/D35-API-事件契约.md
 *
 * V1 策略（OD-05 决策冻结）：
 * - 通用 LLM API 先行（A 路）
 * - 建筑专业 AI（EVAI/小库 AI/建筑学长）维持 ManualHandoff
 * - 企业 IdP 联邦在 W3 启动供应商接触
 *
 * BFF 模式：浏览器仅 Secure/HttpOnly/SameSite Cookie + CSRF
 * access token 短期（≤15min），refresh token ≤7d 支持 rotation
 */

// ── 登录 ──

/** 登录请求 */
export interface LoginRequest {
  email: string;
  password: string;
  /** 是否记住此设备（延长 refresh token 有效期） */
  rememberMe?: boolean;
}

/** 登录响应 */
export interface LoginResponse {
  /** 主体信息 */
  principal: {
    id: string;
    tenantId: string;
    email: string;
    displayName: string;
    type: string;
    status: string;
    locale: string;
    timezone: string;
  };
  /** access token（BFF 模式下由 BFF 持有，不返回给浏览器） */
  accessToken: string;
  /** access token 过期时间（秒） */
  accessTokenExpiresIn: number;
  /** refresh token（通过 httpOnly Cookie 设置，此处仅返回标记） */
  refreshTokenSet: boolean;
  /** 当前租户 */
  tenant: {
    id: string;
    name: string;
    code: string;
    region: string;
    language: string;
  };
  /** 当前角色与权限 */
  roles: string[];
  permissions: string[];
}

// ── Token 刷新 ──

/** Token 刷新响应 */
export interface RefreshTokenResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshTokenSet: boolean;
}

// ── 当前用户信息 ──

/** 当前登录上下文 */
export interface AuthContext {
  principal: {
    id: string;
    tenantId: string;
    email: string;
    displayName: string;
    type: string;
    status: string;
    locale: string;
    timezone: string;
  };
  tenant: {
    id: string;
    name: string;
    code: string;
    region: string;
    language: string;
  };
  roles: string[];
  permissions: string[];
  /** 会话信息 */
  session: {
    id: string;
    issuedAt: string;
    expiresAt: string;
  };
}

// ── 登出 ──

/** 登出请求（refresh token 从 Cookie 读取） */
export interface LogoutRequest {
  /** 是否撤销所有设备的会话 */
  allDevices?: boolean;
}

/** 登出响应 */
export interface LogoutResponse {
  revoked: boolean;
}

// ── 密码修改 ──

/** 修改密码请求 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ── Step-up 二次认证 ──

/**
 * Step-up 认证请求
 *
 * 用于危险动作（HIGH/IRREVERSIBLE 风险等级）执行前的二次认证。
 * 业务流程：用户输入当前密码 → 服务端校验 → 签发短期 step-up token（5 分钟）。
 *
 * @design D40-信息-物理安全.md §Step-up 认证
 * @design D37-关键界面-交互状态.md §D37.17 危险动作
 */
export interface StepUpTokenRequest {
  /** 当前密码（用于二次认证校验） */
  currentPassword: string;
  /** 申请 step-up token 的用途说明（如"执行 ISOLATE 动作"），进入审计日志 */
  purpose: string;
}

/**
 * Step-up 认证响应
 *
 * 返回短期有效的 step-up token，仅可用于 OperationsActionRequest.stepUpToken 字段，
 * 不可用于普通 API 认证。
 */
export interface StepUpTokenResponse {
  /** step-up token 字符串（短期有效，默认 5 分钟） */
  stepUpToken: string;
  /** 有效期（秒） */
  expiresInSeconds: number;
  /** 用途说明（回显请求中的 purpose） */
  purpose: string;
}

// ── API 端点定义 ──

/**
 * 认证 API 端点
 * 基础路径：/api/v1
 */
export const AuthApiPaths = {
  login: "/api/v1/auth/login",
  logout: "/api/v1/auth/logout",
  refresh: "/api/v1/auth/refresh",
  me: "/api/v1/auth/me",
  changePassword: "/api/v1/auth/change-password",
  /** 申请 step-up token（危险动作二次认证） */
  stepUp: "/api/v1/auth/step-up",
} as const;
