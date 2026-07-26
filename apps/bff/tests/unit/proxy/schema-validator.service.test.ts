/**
 * SchemaValidator 服务单元测试
 *
 * 验证：
 *  - 软验证（validateSoft）：失败仅记录告警日志，原数据透传
 *  - 严格验证（validateStrict）：失败抛 BadGatewayException（502）
 *  - 错误信息包含 traceId/domain/operation 上下文
 *  - 错误信息包含 schema 验证失败的 path 与 message
 *
 * 权威源：.trae/rules/security.md §12 AI 安全红线 + §2.2 认证 Token
 */
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { BadGatewayException, Logger } from "@nestjs/common";
import { z } from "zod";
import { SchemaValidator } from "../../../src/proxy/schema-validator.service";

/** 简单测试 schema：含必填字段 + 类型约束 */
const testSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  age: z.number().int().nonnegative(),
});

const validContext = {
  domain: "test",
  operation: "testOp",
  traceId: "trace-001",
  downstreamService: "core-service",
};

const validData = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "张三",
  age: 30,
};

describe("SchemaValidator", () => {
  let validator: SchemaValidator;
  let loggerWarnSpy: Mock;
  let loggerErrorSpy: Mock;

  beforeEach(() => {
    validator = new SchemaValidator();
    // 拦截 logger 输出，避免污染测试控制台，并验证日志调用
    loggerWarnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation();
    loggerErrorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation();
    // 重置失败计数器，避免跨用例污染
    validator.resetFailures();
  });

  describe("validateSoft", () => {
    it("合法数据应返回 success=true 并附带解析后的数据", () => {
      // Act
      const result = validator.validateSoft(
        validData,
        testSchema,
        validContext,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });

    it("非法数据应返回 success=false 并记录告警日志，不抛异常", () => {
      // Arrange
      const invalidData = { id: "not-uuid", name: "x", age: 30 };

      // Act
      const result = validator.validateSoft(
        invalidData,
        testSchema,
        validContext,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      // 错误信息应包含字段路径
      expect(result.errors!.some((e) => e.includes("id"))).toBe(true);
      // 应记录告警日志
      expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
      const logMsg = loggerWarnSpy.mock.calls[0][0] as string;
      expect(logMsg).toContain("domain=test");
      expect(logMsg).toContain("operation=testOp");
      expect(logMsg).toContain("traceId=trace-001");
      expect(logMsg).toContain("downstream=core-service");
      expect(logMsg).toContain("软模式");
    });

    it("合法数据应通过 schema 转换（如字符串转数字）", () => {
      // Arrange - zod 的 coerce 可以转换，但默认严格类型
      const coercedSchema = z.object({
        age: z.coerce.number().int().nonnegative(),
      });

      // Act
      const result = validator.validateSoft(
        { age: "25" },
        coercedSchema,
        validContext,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ age: 25 });
    });

    it("缺少 traceId 时日志应显示 unknown", () => {
      // Arrange
      const ctxWithoutTrace = { domain: "x", operation: "y" };
      const invalidData = { id: "bad" };

      // Act
      validator.validateSoft(invalidData, testSchema, ctxWithoutTrace);

      // Assert
      expect(loggerWarnSpy).toHaveBeenCalled();
      const logMsg = loggerWarnSpy.mock.calls[0][0] as string;
      expect(logMsg).toContain("traceId=unknown");
    });
  });

  describe("validateStrict", () => {
    it("合法数据应返回解析后的数据", () => {
      // Act
      const result = validator.validateStrict(
        validData,
        testSchema,
        validContext,
      );

      // Assert
      expect(result).toEqual(validData);
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it("非法数据应抛 BadGatewayException 并记录错误日志", () => {
      // Arrange
      const invalidData = { id: "not-uuid", name: "x", age: 30 };

      // Act + Assert
      expect(() =>
        validator.validateStrict(invalidData, testSchema, validContext),
      ).toThrow(BadGatewayException);

      // 验证错误日志
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      const logMsg = loggerErrorSpy.mock.calls[0][0] as string;
      expect(logMsg).toContain("严格模式");
      expect(logMsg).toContain("已阻断");
      expect(logMsg).toContain("domain=test");
      expect(logMsg).toContain("operation=testOp");
    });

    it("抛出的异常应包含 errorCode=CONTRACT_VALIDATION_FAILED", () => {
      // Arrange
      const invalidData = { id: "bad" };

      // Act
      let caughtException: BadGatewayException | null = null;
      try {
        validator.validateStrict(invalidData, testSchema, validContext);
      } catch (e) {
        caughtException = e as BadGatewayException;
      }

      // Assert
      expect(caughtException).not.toBeNull();
      expect(caughtException!.getStatus()).toBe(502);
      const response = caughtException!.getResponse() as {
        code: number;
        errorCode: string;
        status: number;
        title: string;
        detail: string;
        correlationId: string;
        errors: string[];
        retryable: boolean;
      };
      expect(response.code).toBe(502);
      expect(response.errorCode).toBe("CONTRACT_VALIDATION_FAILED");
      expect(response.status).toBe(502);
      expect(response.title).toBe("Bad Gateway");
      expect(response.correlationId).toBe("trace-001");
      expect(response.errors.length).toBeGreaterThan(0);
      expect(response.detail).toContain("test.testOp");
      expect(response.retryable).toBe(false);
    });

    it("AI 安全红线：缺少 isAiAssisted 字段应抛异常（schema 红线场景）", () => {
      // Arrange - 模拟 AI 响应 schema（强制 isAiAssisted=true）
      const aiResponseSchema = z.object({
        content: z.string(),
        isAiAssisted: z.literal(true),
        requiresHumanReview: z.boolean(),
      });
      const missingFlag = {
        content: "方案内容",
        // 缺少 isAiAssisted 与 requiresHumanReview
      };

      // Act + Assert
      expect(() =>
        validator.validateStrict(missingFlag, aiResponseSchema, {
          domain: "solutions",
          operation: "generate",
          downstreamService: "ai-service",
        }),
      ).toThrow(BadGatewayException);
    });

    it("AI 安全红线：isAiAssisted=false 应抛异常", () => {
      // Arrange
      const aiResponseSchema = z.object({
        content: z.string(),
        isAiAssisted: z.literal(true),
        requiresHumanReview: z.boolean(),
      });
      const falseFlag = {
        content: "方案内容",
        isAiAssisted: false,
        requiresHumanReview: true,
      };

      // Act + Assert
      expect(() =>
        validator.validateStrict(falseFlag, aiResponseSchema, validContext),
      ).toThrow(BadGatewayException);
    });
  });

  describe("日志上下文关联", () => {
    it("日志应包含完整的 traceId 用于跨服务追踪", () => {
      // Arrange
      const invalidData = { id: "bad" };
      const ctx = {
        domain: "auth",
        operation: "login",
        traceId: "abc-123-def-456",
        downstreamService: "core-service",
      };

      // Act
      validator.validateSoft(invalidData, testSchema, ctx);

      // Assert
      const logMsg = loggerWarnSpy.mock.calls[0][0] as string;
      expect(logMsg).toContain("traceId=abc-123-def-456");
      expect(logMsg).toContain("domain=auth");
      expect(logMsg).toContain("operation=login");
      expect(logMsg).toContain("downstream=core-service");
    });

    it("错误信息应包含字段级 path 与 message 便于定位问题", () => {
      // Arrange
      const invalidData = { id: "not-uuid", name: "", age: -1 };

      // Act
      const result = validator.validateSoft(
        invalidData,
        testSchema,
        validContext,
      );

      // Assert
      expect(result.success).toBe(false);
      const errors = result.errors!;
      // 应该有 3 个错误：id 不合法、name 为空、age 为负数
      expect(errors.length).toBe(3);
      expect(errors.some((e) => e.includes("id"))).toBe(true);
      expect(errors.some((e) => e.includes("name"))).toBe(true);
      expect(errors.some((e) => e.includes("age"))).toBe(true);
    });
  });

  describe("本地失败计数器（V1 可观测性）", () => {
    it("初始状态应返回空快照与零总计", () => {
      expect(validator.readSoftFailureSnapshot()).toEqual({});
      expect(validator.readStrictFailureSnapshot()).toEqual({});
      expect(validator.readFailureTotals()).toEqual({
        softTotal: 0,
        strictTotal: 0,
      });
    });

    it("软验证失败应递增对应 context 的计数器", () => {
      const invalid = { id: "bad", name: "", age: -1 };
      const ctx1 = { ...validContext, operation: "op1", traceId: "t1" };
      const ctx2 = { ...validContext, operation: "op2", traceId: "t2" };

      validator.validateSoft(invalid, testSchema, ctx1);
      validator.validateSoft(invalid, testSchema, ctx1);
      validator.validateSoft(invalid, testSchema, ctx2);

      const snapshot = validator.readSoftFailureSnapshot();
      // ctx1 失败 2 次
      const ctx1Key = "test.op1";
      expect(snapshot[ctx1Key]).toBeDefined();
      const schemaName = Object.keys(snapshot[ctx1Key] ?? {})[0];
      expect(schemaName).toBeDefined();
      expect(snapshot[ctx1Key]?.[schemaName as string]?.count).toBe(2);
      expect(snapshot[ctx1Key]?.[schemaName as string]?.lastTraceId).toBe("t1");

      // ctx2 失败 1 次
      const ctx2Key = "test.op2";
      expect(snapshot[ctx2Key]?.[schemaName as string]?.count).toBe(1);

      // 总计：软 3，严 0
      expect(validator.readFailureTotals()).toEqual({
        softTotal: 3,
        strictTotal: 0,
      });
    });

    it("严格验证失败应递增严格计数器", () => {
      const invalid = { id: "bad" };
      try {
        validator.validateStrict(invalid, testSchema, {
          ...validContext,
          traceId: "strict-trace",
        });
      } catch {
        // 预期抛错
      }

      const snapshot = validator.readStrictFailureSnapshot();
      const ctxKey = "test.testOp";
      expect(snapshot[ctxKey]).toBeDefined();
      const schemaName = Object.keys(snapshot[ctxKey] ?? {})[0];
      expect(schemaName).toBeDefined();
      expect(snapshot[ctxKey]?.[schemaName as string]?.count).toBe(1);
      expect(snapshot[ctxKey]?.[schemaName as string]?.lastTraceId).toBe(
        "strict-trace",
      );

      // 总计：软 0，严 1
      expect(validator.readFailureTotals()).toEqual({
        softTotal: 0,
        strictTotal: 1,
      });
    });

    it("软验证通过不应递增计数器", () => {
      validator.validateSoft(validData, testSchema, validContext);
      expect(validator.readSoftFailureSnapshot()).toEqual({});
      expect(validator.readFailureTotals().softTotal).toBe(0);
    });

    it("严格验证通过不应递增计数器", () => {
      validator.validateStrict(validData, testSchema, validContext);
      expect(validator.readStrictFailureSnapshot()).toEqual({});
      expect(validator.readFailureTotals().strictTotal).toBe(0);
    });

    it("resetFailures 应清空所有计数器", () => {
      const invalid = { id: "bad" };
      validator.validateSoft(invalid, testSchema, validContext);
      try {
        validator.validateStrict(invalid, testSchema, validContext);
      } catch {
        // 预期抛错
      }
      expect(validator.readFailureTotals()).toEqual({
        softTotal: 1,
        strictTotal: 1,
      });

      validator.resetFailures();
      expect(validator.readSoftFailureSnapshot()).toEqual({});
      expect(validator.readStrictFailureSnapshot()).toEqual({});
      expect(validator.readFailureTotals()).toEqual({
        softTotal: 0,
        strictTotal: 0,
      });
    });

    it("快照应记录最近一次失败的 traceId 与 ISO 时间戳", () => {
      const invalid = { id: "bad" };
      const before = new Date().toISOString();
      validator.validateSoft(invalid, testSchema, {
        ...validContext,
        traceId: "snapshot-trace",
      });
      const after = new Date().toISOString();

      const snapshot = validator.readSoftFailureSnapshot();
      const ctxKey = "test.testOp";
      const schemaName = Object.keys(snapshot[ctxKey] ?? {})[0] as string;
      const entry = snapshot[ctxKey]?.[schemaName];
      expect(entry).toBeDefined();
      expect(entry?.lastTraceId).toBe("snapshot-trace");
      expect(entry?.lastFailedAt).toBeDefined();
      // 时间戳应在 [before, after] 区间
      expect(entry?.lastFailedAt >= before).toBe(true);
      expect(entry?.lastFailedAt <= after).toBe(true);
    });
  });
});
