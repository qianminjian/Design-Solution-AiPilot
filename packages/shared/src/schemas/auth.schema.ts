/**
 * 认证域 Zod Schema
 *
 * 权威源：@design/D35-API-事件契约.md
 * 对齐：packages/shared/src/contracts/auth.contract.ts
 *
 * 用途：
 *  - BFF 代理层验证 Core Service 返回的响应结构（Consumer-side 契约验证）
 *  - 前端运行时验证 fetch 响应，防止 API 漂移导致运行时错误
 *  - Core Service 单元测试使用 schema 验证 DTO 字段类型与必填性
 *
 * V1 简化策略：用 zod 共享 schema 替代完整 Pact Broker，后续 V2 可基于
 * schema 自动生成 Pact 契约文件并接入 Pact Broker。
 */
import { z } from "zod";

/** 登录请求 schema */
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional(),
});

/** 登录响应中的主体信息 */
export const principalSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  type: z.string().min(1),
  status: z.string().min(1),
  locale: z.string().min(2),
  timezone: z.string().min(2),
});

/** 登录响应中的租户信息 */
export const tenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1),
  region: z.string().min(1),
  language: z.string().min(2),
});

/** 登录响应 schema */
export const loginResponseSchema = z.object({
  principal: principalSchema,
  accessToken: z.string().min(1),
  accessTokenExpiresIn: z.number().int().positive(),
  refreshTokenSet: z.boolean(),
  tenant: tenantSchema,
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});

/** Token 刷新响应 schema */
export const refreshTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresIn: z.number().int().positive(),
  refreshTokenSet: z.boolean(),
});

/** 当前用户上下文 schema */
export const authContextSchema = z.object({
  principal: principalSchema,
  tenant: tenantSchema,
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  session: z.object({
    id: z.string().uuid(),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  }),
});

/** 登出响应 schema */
export const logoutResponseSchema = z.object({
  revoked: z.boolean(),
});

/** 修改密码请求 schema */
export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});
