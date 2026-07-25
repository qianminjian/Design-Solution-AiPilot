/**
 * IAM 域 Zod Schema
 *
 * 权威源：@design/D39-身份多租户-授权.md + @design/D35-API-事件契约.md §D35.15
 * 对齐：packages/shared/src/contracts/iam.contract.ts
 *
 * 用途：
 *  - BFF 代理层验证 Core Service 返回的租户/组织/主体/成员关系/角色绑定 DTO 结构
 *  - 前端运行时验证创建主体/组织等请求体
 *  - 数据分类字段（classification）校验 PII 等级（security.md §8）
 */
import { z } from "zod";

// ── 枚举 ──

/** 租户状态 schema */
export const tenantStatusSchema = z.enum(["active", "suspended", "terminated"]);

/** 主体类型 schema（D39.4） */
export const principalTypeSchema = z.enum([
  "user",
  "service",
  "agent",
  "device",
  "external",
]);

/** 主体状态 schema */
export const principalStatusSchema = z.enum([
  "active",
  "disabled",
  "locked",
  "pending",
]);

/** 组织类型 schema */
export const organizationTypeSchema = z.enum([
  "enterprise",
  "department",
  "team",
  "external",
]);

/** 组织状态 schema */
export const organizationStatusSchema = z.enum(["active", "archived"]);

/** 成员状态 schema */
export const membershipStatusSchema = z.enum([
  "active",
  "suspended",
  "expired",
]);

/** 角色绑定作用域类型 schema */
export const roleScopeTypeSchema = z.enum([
  "tenant",
  "organization",
  "project",
]);

/** 授权效果 schema */
export const grantEffectSchema = z.enum(["allow", "deny"]);

/** 数据分类等级 schema（安全规则 §8） */
export const dataClassificationSchema = z.enum([
  "public",
  "internal",
  "project_record",
  "sensitive",
  "published_evidence",
]);

// ── 实体 DTO ──

/** 租户 DTO schema */
export const tenantDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1),
  status: tenantStatusSchema,
  region: z.string().min(2),
  language: z.string().min(2),
  classification: dataClassificationSchema,
  settings: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  rowVersion: z.number().int().nonnegative(),
});

/** 组织 DTO schema */
export const organizationDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  name: z.string().min(1),
  type: organizationTypeSchema,
  status: organizationStatusSchema,
  classification: dataClassificationSchema,
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  rowVersion: z.number().int().nonnegative(),
});

/** 主体 DTO schema（不暴露 passwordHash） */
export const principalDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: principalTypeSchema,
  email: z.string().email(),
  displayName: z.string().min(1),
  status: principalStatusSchema,
  locale: z.string().min(2),
  timezone: z.string().min(2),
  classification: dataClassificationSchema,
  externalId: z.string().nullable(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  rowVersion: z.number().int().nonnegative(),
});

/** 成员关系 DTO schema */
export const membershipDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  principalId: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: z.string().min(1),
  status: membershipStatusSchema,
  joinedAt: z.string().datetime(),
  effectiveFrom: z.string().datetime().nullable(),
  effectiveTo: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  rowVersion: z.number().int().nonnegative(),
});

/** 角色绑定 DTO schema */
export const roleBindingDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  principalId: z.string().uuid(),
  roleCode: z.string().min(1),
  scopeType: roleScopeTypeSchema,
  scopeId: z.string().uuid().nullable(),
  status: membershipStatusSchema,
  grantedAt: z.string().datetime(),
  grantedBy: z.string().uuid(),
  effectiveFrom: z.string().datetime().nullable(),
  effectiveTo: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  rowVersion: z.number().int().nonnegative(),
});

/** 显式授权 DTO schema */
export const accessGrantDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  principalId: z.string().uuid(),
  permission: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().uuid().nullable(),
  effect: grantEffectSchema,
  status: membershipStatusSchema,
  grantedAt: z.string().datetime(),
  grantedBy: z.string().uuid(),
  effectiveFrom: z.string().datetime().nullable(),
  effectiveTo: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  rowVersion: z.number().int().nonnegative(),
});

// ── 请求 DTO ──

/** 创建主体请求 schema */
export const createPrincipalRequestSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  password: z.string().min(8),
  type: principalTypeSchema.optional(),
  locale: z.string().min(2).optional(),
  timezone: z.string().min(2).optional(),
  externalId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** 更新主体请求 schema（支持部分更新） */
export const updatePrincipalRequestSchema = z.object({
  displayName: z.string().min(1).optional(),
  status: principalStatusSchema.optional(),
  locale: z.string().min(2).optional(),
  timezone: z.string().min(2).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** 创建组织请求 schema */
export const createOrganizationRequestSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  type: organizationTypeSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** 创建成员关系请求 schema */
export const createMembershipRequestSchema = z.object({
  principalId: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: z.string().min(1),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
});

/** 创建角色绑定请求 schema */
export const createRoleBindingRequestSchema = z.object({
  principalId: z.string().uuid(),
  roleCode: z.string().min(1),
  scopeType: roleScopeTypeSchema,
  scopeId: z.string().uuid().nullable().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
});
