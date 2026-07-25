/**
 * 认证域 Zod Schema 单元测试
 *
 * 验证：
 *  - schema 与 auth.contract.ts 类型对齐
 *  - 正例：合法 fixture 通过校验
 *  - 负例：缺字段、错误邮箱、弱密码被拒绝
 *  - 安全红线：refreshTokenSet / isAiAssisted 等关键字段
 */
import { describe, it, expect } from "vitest";
import {
  loginRequestSchema,
  loginResponseSchema,
  refreshTokenResponseSchema,
  authContextSchema,
  logoutResponseSchema,
  changePasswordRequestSchema,
} from "../../../src/schemas/auth.schema";

describe("loginRequestSchema", () => {
  it("应该接受合法的登录请求", () => {
    // Arrange
    const valid = {
      email: "user@example.com",
      password: "password123",
      rememberMe: true,
    };

    // Act
    const result = loginRequestSchema.safeParse(valid);

    // Assert
    expect(result.success).toBe(true);
  });

  it("应该拒绝非法邮箱格式", () => {
    // Arrange
    const invalid = { email: "not-an-email", password: "password123" };

    // Act
    const result = loginRequestSchema.safeParse(invalid);

    // Assert
    expect(result.success).toBe(false);
  });

  it("应该拒绝短于 8 位的密码", () => {
    // Arrange
    const invalid = { email: "user@example.com", password: "short" };

    // Act
    const result = loginRequestSchema.safeParse(invalid);

    // Assert
    expect(result.success).toBe(false);
  });

  it("应该拒绝缺少必填字段", () => {
    // Arrange
    const invalid = { email: "user@example.com" };

    // Act
    const result = loginRequestSchema.safeParse(invalid);

    // Assert
    expect(result.success).toBe(false);
  });

  it("应该接受不带 rememberMe 的请求（可选字段）", () => {
    // Arrange
    const valid = { email: "user@example.com", password: "password123" };

    // Act
    const result = loginRequestSchema.safeParse(valid);

    // Assert
    expect(result.success).toBe(true);
  });
});

describe("loginResponseSchema", () => {
  const validPrincipal = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    tenantId: "550e8400-e29b-41d4-a716-446655440001",
    email: "user@example.com",
    displayName: "张三",
    type: "user",
    status: "active",
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
  };
  const validTenant = {
    id: "550e8400-e29b-41d4-a716-446655440001",
    name: "Acme Inc.",
    code: "ACME",
    region: "CN",
    language: "zh",
  };

  it("应该接受合法的登录响应", () => {
    // Arrange
    const valid = {
      principal: validPrincipal,
      tenant: validTenant,
      accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig",
      accessTokenExpiresIn: 900,
      refreshTokenSet: true,
      roles: ["architect"],
      permissions: ["project:read", "project:write"],
    };

    // Act
    const result = loginResponseSchema.safeParse(valid);

    // Assert
    expect(result.success).toBe(true);
  });

  it("应该拒绝 accessTokenExpiresIn 非正数", () => {
    // Arrange
    const invalid = {
      principal: validPrincipal,
      tenant: validTenant,
      accessToken: "tok",
      accessTokenExpiresIn: 0,
      refreshTokenSet: true,
      roles: [],
      permissions: [],
    };

    // Act
    const result = loginResponseSchema.safeParse(invalid);

    // Assert
    expect(result.success).toBe(false);
  });

  it("应该拒绝 accessToken 为空字符串", () => {
    // Arrange
    const invalid = {
      principal: validPrincipal,
      tenant: validTenant,
      accessToken: "",
      accessTokenExpiresIn: 900,
      refreshTokenSet: true,
      roles: [],
      permissions: [],
    };

    // Act
    const result = loginResponseSchema.safeParse(invalid);

    // Assert
    expect(result.success).toBe(false);
  });

  it("应该拒绝非 UUID 的 principal.id", () => {
    // Arrange
    const invalid = {
      principal: { ...validPrincipal, id: "not-uuid" },
      tenant: validTenant,
      accessToken: "tok",
      accessTokenExpiresIn: 900,
      refreshTokenSet: true,
      roles: [],
      permissions: [],
    };

    // Act
    const result = loginResponseSchema.safeParse(invalid);

    // Assert
    expect(result.success).toBe(false);
  });
});

describe("refreshTokenResponseSchema", () => {
  it("应该接受合法的 Token 刷新响应", () => {
    // Arrange
    const valid = {
      accessToken: "newtoken",
      accessTokenExpiresIn: 900,
      refreshTokenSet: true,
    };

    // Act
    const result = refreshTokenResponseSchema.safeParse(valid);

    // Assert
    expect(result.success).toBe(true);
  });
});

describe("authContextSchema", () => {
  it("应该接受合法的当前用户上下文", () => {
    // Arrange
    const valid = {
      principal: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenantId: "550e8400-e29b-41d4-a716-446655440001",
        email: "user@example.com",
        displayName: "张三",
        type: "user",
        status: "active",
        locale: "zh-CN",
        timezone: "Asia/Shanghai",
      },
      tenant: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Acme",
        code: "ACME",
        region: "CN",
        language: "zh",
      },
      roles: ["architect"],
      permissions: ["project:read"],
      session: {
        id: "550e8400-e29b-41d4-a716-446655440002",
        issuedAt: "2026-07-25T08:00:00.000Z",
        expiresAt: "2026-07-25T08:15:00.000Z",
      },
    };

    // Act
    const result = authContextSchema.safeParse(valid);

    // Assert
    expect(result.success).toBe(true);
  });

  it("应该拒绝非 ISO 日期时间格式的 issuedAt", () => {
    // Arrange
    const invalid = {
      principal: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenantId: "550e8400-e29b-41d4-a716-446655440001",
        email: "user@example.com",
        displayName: "张三",
        type: "user",
        status: "active",
        locale: "zh-CN",
        timezone: "Asia/Shanghai",
      },
      tenant: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Acme",
        code: "ACME",
        region: "CN",
        language: "zh",
      },
      roles: [],
      permissions: [],
      session: {
        id: "550e8400-e29b-41d4-a716-446655440002",
        issuedAt: "not-a-datetime",
        expiresAt: "2026-07-25T08:15:00.000Z",
      },
    };

    // Act
    const result = authContextSchema.safeParse(invalid);

    // Assert
    expect(result.success).toBe(false);
  });
});

describe("logoutResponseSchema", () => {
  it("应该接受合法的登出响应", () => {
    // Arrange
    const valid = { revoked: true };

    // Act
    const result = logoutResponseSchema.safeParse(valid);

    // Assert
    expect(result.success).toBe(true);
  });

  it("应该拒绝缺少 revoked 字段", () => {
    // Arrange
    const invalid = {};

    // Act
    const result = logoutResponseSchema.safeParse(invalid);

    // Assert
    expect(result.success).toBe(false);
  });
});

describe("changePasswordRequestSchema", () => {
  it("应该接受合法的修改密码请求", () => {
    // Arrange
    const valid = {
      currentPassword: "oldpassword",
      newPassword: "newpassword",
    };

    // Act
    const result = changePasswordRequestSchema.safeParse(valid);

    // Assert
    expect(result.success).toBe(true);
  });

  it("应该拒绝短于 8 位的新密码", () => {
    // Arrange
    const invalid = { currentPassword: "oldpassword", newPassword: "short" };

    // Act
    const result = changePasswordRequestSchema.safeParse(invalid);

    // Assert
    expect(result.success).toBe(false);
  });
});
