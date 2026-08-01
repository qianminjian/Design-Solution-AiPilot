/**
 * Pact 契约软验证单元测试（P0-1.3 契约测试基础设施）
 *
 * 覆盖：
 *  - validateResponse：soft 级别通过/失败、strict 级别抛异常、passthrough 直通
 *  - validateRequest：请求体验证（GET/POST 场景）
 *  - schema=null 的契约（GET/DELETE 无请求体或响应体）
 *  - ContractValidationError 字段完整性
 *  - isWriteOperation 工具函数行为
 *  - DEFAULT_STRICTNESS 常量值
 *
 * 权威源：@design/D45-测试-验收体系.md §D45.11 HTTP/OpenAPI 契约
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  ContractValidationError,
  DEFAULT_STRICTNESS,
  isWriteOperation,
  validateRequest,
  validateResponse,
  type ConsumerExpectation,
} from "../../../../src/contracts/pact";

// ── 测试用 zod schema ──

const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
});

// ── 测试用 Consumer 期望声明 ──

const loginExpectation: ConsumerExpectation<
  typeof loginRequestSchema,
  typeof loginResponseSchema
> = {
  contractId: "auth-login-v1",
  consumer: "@design-platform/bff",
  provider: "@design-platform/core",
  domain: "auth",
  method: "POST",
  path: "/api/v1/auth/login",
  description: "用户登录",
  requestSchema: loginRequestSchema,
  responseSchema: loginResponseSchema,
  strictness: "soft",
  version: "1.0.0",
};

const logoutExpectation: ConsumerExpectation<null, null> = {
  contractId: "auth-logout-v1",
  consumer: "@design-platform/bff",
  provider: "@design-platform/core",
  domain: "auth",
  method: "POST",
  path: "/api/v1/auth/logout",
  description: "用户登出",
  requestSchema: null,
  responseSchema: null,
  strictness: "passthrough",
  version: "1.0.0",
};

const strictCreateExpectation: ConsumerExpectation<
  typeof loginRequestSchema,
  typeof loginResponseSchema
> = {
  ...loginExpectation,
  contractId: "auth-strict-create-v1",
  strictness: "strict",
  description: "严格验证的创建操作",
};

// ──────────────────────────────────────────────────────────────
// validateResponse
// ──────────────────────────────────────────────────────────────

describe("validateResponse", () => {
  it("应该在数据符合 schema 时返回 success=true（soft 级别）", () => {
    const validData = {
      accessToken: "jwt-token-abc",
      expiresIn: 900,
    };

    const result = validateResponse(loginExpectation, validData);

    expect(result.success).toBe(true);
    expect(result.contractId).toBe("auth-login-v1");
    expect(result.interactionType).toBe("response");
    expect(result.errors).toEqual([]);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("应该在数据不符合 schema 时返回 success=false 并收集错误（soft 级别不抛异常）", () => {
    const invalidData = {
      accessToken: "", // 空字符串违反 min(1)
      expiresIn: -1, // 负数违反 positive
    };

    const result = validateResponse(loginExpectation, invalidData);

    expect(result.success).toBe(false);
    expect(result.contractId).toBe("auth-login-v1");
    expect(result.interactionType).toBe("response");
    expect(result.errors.length).toBeGreaterThan(0);
    // 错误信息应包含字段路径与 code
    expect(result.errors.some((e) => e.includes("accessToken"))).toBe(true);
    expect(result.errors.some((e) => e.includes("expiresIn"))).toBe(true);
    expect(result.errors.some((e) => e.includes("code="))).toBe(true);
  });

  it("应该在 strict 级别验证失败时抛出 ContractValidationError", () => {
    const invalidData = { accessToken: "", expiresIn: -1 };

    expect(() =>
      validateResponse(strictCreateExpectation, invalidData),
    ).toThrow(ContractValidationError);
  });

  it("strict 级别抛出的异常应携带契约 ID、描述与错误列表", () => {
    const invalidData = { accessToken: "", expiresIn: -1 };

    try {
      validateResponse(strictCreateExpectation, invalidData);
      expect.fail("应该抛出 ContractValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ContractValidationError);
      const e = error as ContractValidationError;
      expect(e.contractId).toBe("auth-strict-create-v1");
      expect(e.contractDescription).toBe("严格验证的创建操作");
      expect(e.validationErrors.length).toBeGreaterThan(0);
      expect(e.name).toBe("ContractValidationError");
      expect(e.message).toContain("auth-strict-create-v1");
    }
  });

  it("应该在 strict 级别数据合法时返回 success=true（不抛异常）", () => {
    const validData = { accessToken: "valid-token", expiresIn: 900 };

    const result = validateResponse(strictCreateExpectation, validData);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("应该在 passthrough 级别直接返回 success=true 而不执行验证", () => {
    // 故意传入明显不合法的数据，passthrough 应跳过验证
    const invalidData = { foo: "bar" };

    const result = validateResponse(logoutExpectation, invalidData);

    expect(result.success).toBe(true);
    expect(result.contractId).toBe("auth-logout-v1");
    expect(result.errors).toEqual([]);
  });

  it("应该在 responseSchema=null 时直接返回 success=true", () => {
    const expectationWithNullSchema: ConsumerExpectation<
      typeof loginRequestSchema,
      null
    > = {
      ...loginExpectation,
      contractId: "auth-delete-v1",
      responseSchema: null,
      strictness: "soft",
    };

    const result = validateResponse(expectationWithNullSchema, {
      anyData: "ok",
    });

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// validateRequest
// ──────────────────────────────────────────────────────────────

describe("validateRequest", () => {
  it("应该在请求体符合 schema 时返回 success=true", () => {
    const validRequest = {
      email: "user@example.com",
      password: "validPass123",
    };

    const result = validateRequest(loginExpectation, validRequest);

    expect(result.success).toBe(true);
    expect(result.interactionType).toBe("request");
    expect(result.errors).toEqual([]);
  });

  it("应该在请求体不符合 schema 时返回 success=false（soft 级别）", () => {
    const invalidRequest = {
      email: "not-an-email",
      password: "short", // 短于 8 字符
    };

    const result = validateRequest(loginExpectation, invalidRequest);

    expect(result.success).toBe(false);
    expect(result.interactionType).toBe("request");
    expect(result.errors.some((e) => e.includes("email"))).toBe(true);
    expect(result.errors.some((e) => e.includes("password"))).toBe(true);
  });

  it("应该在 requestSchema=null 时直接返回 success=true（GET 场景）", () => {
    const getExpectation: ConsumerExpectation<
      null,
      typeof loginResponseSchema
    > = {
      ...loginExpectation,
      contractId: "auth-me-v1",
      method: "GET",
      requestSchema: null,
    };

    const result = validateRequest(getExpectation, undefined);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("应该在 strict 级别请求体验证失败时抛出异常", () => {
    const invalidRequest = { email: "bad", password: "x" };

    expect(() =>
      validateRequest(strictCreateExpectation, invalidRequest),
    ).toThrow(ContractValidationError);
  });
});

// ──────────────────────────────────────────────────────────────
// ContractValidationError
// ──────────────────────────────────────────────────────────────

describe("ContractValidationError", () => {
  it("应该正确设置 name 与 message 字段", () => {
    const error = new ContractValidationError("test-contract-v1", "测试契约", [
      "field.a: invalid_type (code=invalid_type)",
    ]);

    expect(error.name).toBe("ContractValidationError");
    expect(error.contractId).toBe("test-contract-v1");
    expect(error.contractDescription).toBe("测试契约");
    expect(error.validationErrors).toHaveLength(1);
    expect(error.message).toContain("test-contract-v1");
    expect(error.message).toContain("测试契约");
    expect(error.message).toContain("invalid_type");
  });

  it("应该支持多个验证错误", () => {
    const error = new ContractValidationError("c1", "描述", [
      "a: err1",
      "b: err2",
      "c: err3",
    ]);

    expect(error.validationErrors).toHaveLength(3);
    expect(error.message).toContain("a: err1");
    expect(error.message).toContain("b: err2");
    expect(error.message).toContain("c: err3");
  });
});

// ──────────────────────────────────────────────────────────────
// isWriteOperation
// ──────────────────────────────────────────────────────────────

describe("isWriteOperation", () => {
  it("GET 应该返回 false", () => {
    expect(isWriteOperation("GET")).toBe(false);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
    "%s 应该返回 true",
    (method) => {
      expect(isWriteOperation(method)).toBe(true);
    },
  );
});

// ──────────────────────────────────────────────────────────────
// DEFAULT_STRICTNESS
// ──────────────────────────────────────────────────────────────

describe("DEFAULT_STRICTNESS", () => {
  it("默认严格级别应该是 soft", () => {
    expect(DEFAULT_STRICTNESS).toBe("soft");
  });
});

// ──────────────────────────────────────────────────────────────
// 边界场景
// ──────────────────────────────────────────────────────────────

describe("边界场景", () => {
  it("durationMs 应该是非负整数", () => {
    const result = validateResponse(loginExpectation, {
      accessToken: "token",
      expiresIn: 900,
    });

    expect(Number.isInteger(result.durationMs)).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("复杂嵌套对象的验证错误应包含完整路径", () => {
    const nestedSchema = z.object({
      user: z.object({
        profile: z.object({
          age: z.number().min(18),
        }),
      }),
    });

    const expectation: ConsumerExpectation<null, typeof nestedSchema> = {
      contractId: "nested-test-v1",
      consumer: "test-consumer",
      provider: "test-provider",
      domain: "test",
      method: "GET",
      path: "/api/v1/test",
      description: "嵌套对象测试",
      requestSchema: null,
      responseSchema: nestedSchema,
      strictness: "soft",
      version: "1.0.0",
    };

    const result = validateResponse(expectation, {
      user: { profile: { age: 10 } }, // age < 18
    });

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("user.profile.age"))).toBe(
      true,
    );
  });

  it("passthrough 级别不应执行任何 zod 验证（即使数据完全不符合 schema）", () => {
    const strictSchema = z.object({
      required: z.string().min(1),
    });

    const passthroughExpectation: ConsumerExpectation<
      null,
      typeof strictSchema
    > = {
      contractId: "passthrough-v1",
      consumer: "test",
      provider: "test",
      domain: "test",
      method: "GET",
      path: "/api/v1/test",
      description: "passthrough 测试",
      requestSchema: null,
      responseSchema: strictSchema,
      strictness: "passthrough",
      version: "1.0.0",
    };

    const result = validateResponse(passthroughExpectation, null);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
