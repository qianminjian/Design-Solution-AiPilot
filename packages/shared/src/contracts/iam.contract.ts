/**
 * IAM 域 API 契约
 * 权威源：@design/D39-身份多租户-授权.md + @design/D35-API-事件契约.md §D35.15
 *
 * V1 阶段仅落地 6 张核心表（tenant/organization/principal/membership/role_binding/access_grant）
 * 完整 IAM 设计含 20 类对象，后续迁移增量补充
 */

// ── 枚举 ──

/** 租户状态 */
export type TenantStatus = "active" | "suspended" | "terminated";

/** 主体类型（D39.4） */
export type PrincipalType =
  "user" | "service" | "agent" | "device" | "external";

/** 主体状态 */
export type PrincipalStatus = "active" | "disabled" | "locked" | "pending";

/** 组织类型 */
export type OrganizationType =
  "enterprise" | "department" | "team" | "external";

/** 组织状态 */
export type OrganizationStatus = "active" | "archived";

/** 成员状态 */
export type MembershipStatus = "active" | "suspended" | "expired";

/** 角色绑定作用域类型 */
export type RoleScopeType = "tenant" | "organization" | "project";

/** 授权效果 */
export type GrantEffect = "allow" | "deny";

/** 数据分类等级（安全规则 §8） */
export type DataClassification =
  "public" | "internal" | "project_record" | "sensitive" | "published_evidence";

// ── 实体 DTO ──

/** 租户 DTO */
export interface TenantDto {
  id: string;
  name: string;
  code: string;
  status: TenantStatus;
  region: string;
  language: string;
  classification: DataClassification;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/** 组织 DTO */
export interface OrganizationDto {
  id: string;
  tenantId: string;
  parentId: string | null;
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  classification: DataClassification;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/** 主体 DTO（不暴露 passwordHash） */
export interface PrincipalDto {
  id: string;
  tenantId: string;
  type: PrincipalType;
  email: string;
  displayName: string;
  status: PrincipalStatus;
  locale: string;
  timezone: string;
  classification: DataClassification;
  externalId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/** 成员关系 DTO */
export interface MembershipDto {
  id: string;
  tenantId: string;
  principalId: string;
  organizationId: string;
  role: string;
  status: MembershipStatus;
  joinedAt: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/** 角色绑定 DTO */
export interface RoleBindingDto {
  id: string;
  tenantId: string;
  principalId: string;
  roleCode: string;
  scopeType: RoleScopeType;
  scopeId: string | null;
  status: MembershipStatus;
  grantedAt: string;
  grantedBy: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/** 显式授权 DTO */
export interface AccessGrantDto {
  id: string;
  tenantId: string;
  principalId: string;
  permission: string;
  resourceType: string;
  resourceId: string | null;
  effect: GrantEffect;
  status: MembershipStatus;
  grantedAt: string;
  grantedBy: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

// ── 请求 DTO ──

/** 创建主体请求 */
export interface CreatePrincipalRequest {
  email: string;
  displayName: string;
  password: string;
  type?: PrincipalType;
  locale?: string;
  timezone?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

/** 更新主体请求（支持部分更新） */
export interface UpdatePrincipalRequest {
  displayName?: string;
  status?: PrincipalStatus;
  locale?: string;
  timezone?: string;
  metadata?: Record<string, unknown>;
}

/** 创建组织请求 */
export interface CreateOrganizationRequest {
  parentId?: string | null;
  name: string;
  type?: OrganizationType;
  metadata?: Record<string, unknown>;
}

/** 创建成员关系请求 */
export interface CreateMembershipRequest {
  principalId: string;
  organizationId: string;
  role: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

/** 创建角色绑定请求 */
export interface CreateRoleBindingRequest {
  principalId: string;
  roleCode: string;
  scopeType: RoleScopeType;
  scopeId?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string;
}

// ── API 端点定义 ──

// ── 用户偏好设置（V1） ──

/** 单位制 */
export type UnitSystem = "metric" | "imperial";

/** 主题模式 */
export type ThemeMode = "light" | "dark" | "system";

/** 用户偏好设置 DTO（不含 locale/timezone，已存在 Principal 中） */
export interface UserPreferencesDto {
  id: string | null;
  principalId: string;
  /** 单位制 */
  unitSystem: UnitSystem;
  /** 币种代码 */
  currency: string;
  /** 主题模式 */
  theme: ThemeMode;
  /** 邮件通知 */
  emailNotify: boolean;
  /** 应用内通知 */
  inAppNotify: boolean;
  /** 每日摘要 */
  dailyDigest: boolean;
  /** @提及通知 */
  mentionNotify: boolean;
  /** 显示 AI 安全 Banner（仅影响 UI） */
  showAiSafetyBanner: boolean;
  /** 高亮显示人工复核徽章（仅影响 UI） */
  requireHumanReviewBadge: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  rowVersion: number | null;
}

/** 更新用户偏好设置请求（PUT 全量替换） */
export interface UpdateUserPreferencesRequest {
  unitSystem: UnitSystem;
  currency: string;
  theme: ThemeMode;
  emailNotify: boolean;
  inAppNotify: boolean;
  dailyDigest: boolean;
  mentionNotify: boolean;
  showAiSafetyBanner: boolean;
  requireHumanReviewBadge: boolean;
}

// ── API Token（V1 IAM Token API） ──

/** API Token 状态：active（生效中）/ expired（已过期）/ revoked（已撤销） */
export type ApiTokenStatus = "active" | "expired" | "revoked";

/**
 * API Token DTO（列表/详情查询用，不含 token 明文）
 *
 * 安全约束：明文 token 仅在 CreateApiTokenResponse 中返回一次。
 */
export interface ApiTokenDto {
  id: string;
  principalId: string;
  /** Token 名称（用户可读，租户+主体范围内唯一） */
  name: string;
  /** 前缀（仅展示前 12 位用于识别） */
  prefix: string;
  /** 权限范围（最小权限原则） */
  scopes: string[];
  status: ApiTokenStatus;
  /** 过期时间（ISO-8601） */
  expiresAt: string;
  /** 最后使用时间（首次使用后填充，可能为 null） */
  lastUsedAt: string | null;
  /** 撤销时间（仅 status=revoked 时填充，可能为 null） */
  revokedAt: string | null;
  /** 撤销原因（可选，用于审计追溯） */
  revokedReason: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

/**
 * 创建 API Token 请求
 *
 * 安全约束：
 *  - name：3-100 字符，租户+主体范围内唯一
 *  - scopes：至少 1 个，遵循最小权限原则
 *  - expiresAt：必须晚于当前时间，且 ≤ 当前时间 + 90 天
 */
export interface CreateApiTokenRequest {
  name: string;
  scopes: string[];
  /** 过期时间（ISO-8601 字符串，由后端解析为 Instant） */
  expiresAt: string;
}

/**
 * 创建 API Token 响应
 *
 * 安全约束：包含 plainToken 字段，仅在创建时返回一次。
 * 前端必须立即复制保存，关闭对话框后无法再次获取。
 */
export interface CreateApiTokenResponse {
  id: string;
  principalId: string;
  name: string;
  prefix: string;
  /** 完整明文 token（仅本次响应返回，之后不可获取） */
  plainToken: string;
  scopes: string[];
  status: ApiTokenStatus;
  expiresAt: string;
  createdAt: string;
}

/** 撤销 API Token 请求（reason 可选，用于审计追溯） */
export interface RevokeApiTokenRequest {
  reason?: string;
}

/**
 * IAM API 端点
 * 基础路径：/api/v1
 */
export const IamApiPaths = {
  // 主体
  principals: "/api/v1/principals",
  principal: (id: string) => `/api/v1/principals/${id}`,
  // 当前用户偏好设置（V1）
  myPreferences: "/api/v1/users/me/preferences",
  // API Tokens（V1）
  apiTokens: "/api/v1/iam/tokens",
  apiToken: (id: string) => `/api/v1/iam/tokens/${id}`,
  // 组织
  organizations: "/api/v1/organizations",
  organization: (id: string) => `/api/v1/organizations/${id}`,
  // 成员关系
  memberships: "/api/v1/memberships",
  membership: (id: string) => `/api/v1/memberships/${id}`,
  // 角色绑定
  roleBindings: "/api/v1/role-bindings",
  roleBinding: (id: string) => `/api/v1/role-bindings/${id}`,
  // 授权
  grants: "/api/v1/grants",
  grant: (id: string) => `/api/v1/grants/${id}`,
} as const;
