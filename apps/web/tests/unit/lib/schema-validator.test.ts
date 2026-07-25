import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  ResponseValidationError,
  validateResponse,
  validateResponseStrict,
  readSchemaValidationFailures,
  resetSchemaValidationFailures,
} from "@/lib/schema-validator";

/**
 * Schema Validator 单元测试
 *
 * 验证策略：
 *  - 软验证：通过返回解析数据，失败 console.warn 后透传原数据
 *  - 严格验证：通过返回解析数据，失败抛 ResponseValidationError
 */

// 测试用 schema
const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().int().nonnegative(),
});

// 合法用户 fixture
const validUser = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
  age: 28,
};

describe("schema-validator", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    resetSchemaValidationFailures();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    resetSchemaValidationFailures();
  });

  describe("validateResponse (软验证)", () => {
    it("应该在数据符合 schema 时返回解析后的数据", () => {
      const result = validateResponse(validUser, userSchema, {
        context: "test.valid",
      });
      expect(result).toEqual(validUser);
      // 不应记录 console.warn
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("应该在数据不符合 schema 时记录 console.warn 并透传原数据", () => {
      const invalidUser = {
        id: "not-a-uuid",
        email: "invalid",
        age: -1,
      };
      const result = validateResponse(invalidUser, userSchema, {
        context: "test.invalid",
      });
      // 透传原数据（类型断言，前端不阻断）
      expect(result).toBe(invalidUser);
      // 应记录 console.warn
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const firstCall = consoleWarnSpy.mock.calls[0];
      const warnMsg = (firstCall?.[0] ?? "") as string;
      expect(warnMsg).toContain("test.invalid");
      expect(warnMsg).toContain("ResponseValidationError");
    });

    it("应该在缺失字段时正确报告 path", () => {
      const partialData = { id: "550e8400-e29b-41d4-a716-446655440000" };
      const result = validateResponse(partialData, userSchema, {
        context: "test.missing",
      });
      expect(result).toBe(partialData);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const firstCall = consoleWarnSpy.mock.calls[0];
      const warnMsg = (firstCall?.[0] ?? "") as string;
      // 缺失字段应包含在 issues 中
      expect(warnMsg).toContain("email");
      expect(warnMsg).toContain("age");
    });
  });

  describe("validateResponseStrict (严格验证)", () => {
    it("应该在数据符合 schema 时返回解析后的数据", () => {
      const result = validateResponseStrict(validUser, userSchema, {
        context: "test.strict.valid",
      });
      expect(result).toEqual(validUser);
    });

    it("应该在数据不符合 schema 时抛 ResponseValidationError", () => {
      const invalidUser = {
        id: "not-a-uuid",
        email: "invalid",
        age: -1,
      };
      expect(() =>
        validateResponseStrict(invalidUser, userSchema, {
          context: "test.strict.invalid",
        }),
      ).toThrow(ResponseValidationError);
    });

    it("应该在异常中携带完整的 issues 与 context", () => {
      const invalidUser = { id: "550e8400-e29b-41d4-a716-446655440000" };
      try {
        validateResponseStrict(invalidUser, userSchema, {
          context: "test.strict.issues",
        });
        expect.fail("应抛 ResponseValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ResponseValidationError);
        const e = error as ResponseValidationError;
        expect(e.context).toBe("test.strict.issues");
        expect(e.issues.length).toBeGreaterThan(0);
        // 缺失 email 与 age
        const paths = e.issues.map((i) => i.path);
        expect(paths).toContain("email");
        expect(paths).toContain("age");
      }
    });

    it("应该在异常 message 中包含 context 与所有 issues", () => {
      const invalidUser = { id: "not-a-uuid" };
      try {
        validateResponseStrict(invalidUser, userSchema, {
          context: "useAuth.login",
        });
        expect.fail("应抛 ResponseValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ResponseValidationError);
        const e = error as ResponseValidationError;
        expect(e.message).toContain("useAuth.login");
        expect(e.message).toContain("id");
        expect(e.message).toContain("email");
        expect(e.message).toContain("age");
      }
    });
  });

  describe("ResponseValidationError", () => {
    it("应该正确序列化 issues 数组", () => {
      const badSchema = z.object({
        required: z.string().min(1),
      });
      try {
        validateResponseStrict({}, badSchema, { context: "serialize-test" });
        expect.fail("应抛 ResponseValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ResponseValidationError);
        const e = error as ResponseValidationError;
        expect(Array.isArray(e.issues)).toBe(true);
        expect(e.issues.length).toBe(1);
        const firstIssue = e.issues[0];
        expect(firstIssue?.path).toBe("required");
        expect(typeof firstIssue?.message).toBe("string");
      }
    });

    it("应该正确设置 name 与继承 Error 行为", () => {
      const badSchema = z.object({ x: z.string() });
      try {
        validateResponseStrict({}, badSchema, { context: "name-test" });
        expect.fail("应抛 ResponseValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ResponseValidationError);
        expect(error).toBeInstanceOf(Error);
        const e = error as ResponseValidationError;
        expect(e.name).toBe("ResponseValidationError");
      }
    });
  });

  describe("本地失败计数器（V1 可观测性）", () => {
    it("初始状态应该返回空快照", () => {
      expect(readSchemaValidationFailures()).toEqual({});
    });

    it("软验证失败应该递增对应 context 计数器", () => {
      const invalid = { id: "bad", email: "bad", age: -1 };
      validateResponse(invalid, userSchema, { context: "useReview.test1" });
      validateResponse(invalid, userSchema, { context: "useReview.test1" });
      validateResponse(invalid, userSchema, { context: "useReview.test2" });

      const snapshot = readSchemaValidationFailures();
      // useReview.test1 两次失败
      const ctx1 = snapshot["useReview.test1"];
      expect(ctx1).toBeDefined();
      const schemaName = Object.keys(ctx1 ?? {})[0];
      expect(schemaName).toBeDefined();
      expect(ctx1?.[schemaName as string]).toBe(2);
      // useReview.test2 一次失败
      const ctx2 = snapshot["useReview.test2"];
      expect(ctx2?.[schemaName as string]).toBe(1);
    });

    it("严格验证失败应该递增对应 context 计数器", () => {
      const invalid = { id: "bad" };
      try {
        validateResponseStrict(invalid, userSchema, {
          context: "useAuth.strict.counter",
        });
      } catch {
        // 预期抛错
      }
      const snapshot = readSchemaValidationFailures();
      const ctx = snapshot["useAuth.strict.counter"];
      expect(ctx).toBeDefined();
      const schemaName = Object.keys(ctx ?? {})[0];
      expect(schemaName).toBeDefined();
      expect(ctx?.[schemaName as string]).toBe(1);
    });

    it("软验证通过不应该递增计数器", () => {
      validateResponse(validUser, userSchema, { context: "pass.test" });
      expect(readSchemaValidationFailures()).toEqual({});
    });

    it("resetSchemaValidationFailures 应该清空所有计数", () => {
      const invalid = { id: "bad" };
      validateResponse(invalid, userSchema, { context: "reset.test" });
      expect(
        Object.keys(readSchemaValidationFailures()).length,
      ).toBeGreaterThan(0);

      resetSchemaValidationFailures();
      expect(readSchemaValidationFailures()).toEqual({});
    });
  });
});
