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

/**
 * IAM API 端点
 * 基础路径：/api/v1
 */
export const IamApiPaths = {
  // 主体
  principals: "/api/v1/principals",
  principal: (id: string) => `/api/v1/principals/${id}`,
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
