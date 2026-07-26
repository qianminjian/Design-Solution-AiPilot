/**
 * IAM 代理辅助函数单元测试
 *
 * 覆盖：
 * - extractBody：HTTP 方法分流（GET/HEAD/DELETE 无 body）
 * - extractForwardHeaders：转发头白名单与 traceId 注入
 * - normalizeQuery：query 参数归一化（string / string[] / 过滤非法）
 * - matchSchema / validateByRules：path 正则匹配与严格校验
 * - proxyWithValidation：端到端转发与 2xx 验证流程
 *
 * 权威源：.trae/rules/api-conventions.md §traceId 传播
 */
import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import type { ZodType } from "zod";
import { z } from "zod";

import {
  extractBody,
  extractForwardHeaders,
  normalizeQuery,
  proxyWithValidation,
  type SchemaMatchRule,
} from "../../../../src/proxy/iam/iam-proxy.helpers";
import type { ProxyResult } from "../../../../src/interceptors/proxy.interceptor";

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/api/v1/iam/principals",
    body: undefined,
    header: vi.fn(() => undefined),
    query: {},
    traceId: "trace-test-001",
    ...overrides,
  } as unknown as Request;
}

describe("extractBody", () => {
  it("GET 方法应返回 undefined", () => {
    const req = createMockRequest({ method: "GET", body: { name: "x" } });
    expect(extractBody(req)).toBeUndefined();
  });

  it("HEAD 方法应返回 undefined", () => {
    const req = createMockRequest({ method: "HEAD", body: { name: "x" } });
    expect(extractBody(req)).toBeUndefined();
  });

  it("DELETE 方法应返回 undefined", () => {
    const req = createMockRequest({ method: "DELETE", body: { id: "x" } });
    expect(extractBody(req)).toBeUndefined();
  });

  it("POST 方法应透传 request.body", () => {
    const body = { name: "张三", email: "zhangsan@example.com" };
    const req = createMockRequest({ method: "POST", body });
    expect(extractBody(req)).toEqual(body);
  });

  it("PATCH 方法应透传 request.body", () => {
    const body = { displayName: "李四" };
    const req = createMockRequest({ method: "PATCH", body });
    expect(extractBody(req)).toEqual(body);
  });

  it("PUT 方法应透传 request.body", () => {
    const body = { name: "updated" };
    const req = createMockRequest({ method: "PUT", body });
    expect(extractBody(req)).toEqual(body);
  });

  it("方法名应大小写不敏感（小写 get 也按 GET 处理）", () => {
    const req = createMockRequest({ method: "get", body: { a: 1 } });
    expect(extractBody(req)).toBeUndefined();
  });
});

describe("extractForwardHeaders", () => {
  it("应仅返回白名单内存在的 header", () => {
    const req = createMockRequest();
    req.header = vi.fn((name: string) => {
      const map: Record<string, string> = {
        authorization: "Bearer token-abc",
        "x-tenant-id": "tenant-001",
        "x-trace-id": "trace-xyz",
      };
      return map[name] ?? undefined;
    }) as unknown as Request["header"];

    const result = extractForwardHeaders(req);
    expect(result["authorization"]).toBe("Bearer token-abc");
    expect(result["x-tenant-id"]).toBe("tenant-001");
    expect(result["x-trace-id"]).toBe("trace-xyz");
  });

  it("白名单内未设置的 header 应不出现", () => {
    const req = createMockRequest();
    req.header = vi.fn(() => undefined) as unknown as Request["header"];
    const result = extractForwardHeaders(req);
    // traceId 仍应从 request.traceId 注入
    expect(result["x-trace-id"]).toBe("trace-test-001");
    expect(result["authorization"]).toBeUndefined();
  });

  it("当 x-trace-id 缺失时应从 request.traceId 注入", () => {
    const req = createMockRequest();
    req.header = vi.fn(() => undefined) as unknown as Request["header"];
    req.traceId = "fallback-trace-id";
    const result = extractForwardHeaders(req);
    expect(result["x-trace-id"]).toBe("fallback-trace-id");
  });

  it("当 x-trace-id 已存在时不应被 request.traceId 覆盖", () => {
    const req = createMockRequest();
    req.header = vi.fn((name: string) => {
      if (name === "x-trace-id") return "header-trace-id";
      return undefined;
    }) as unknown as Request["header"];
    req.traceId = "request-trace-id";
    const result = extractForwardHeaders(req);
    expect(result["x-trace-id"]).toBe("header-trace-id");
  });

  it("空字符串 header 应被过滤", () => {
    const req = createMockRequest();
    req.header = vi.fn((name: string) => {
      if (name === "authorization") return "";
      if (name === "x-tenant-id") return "tenant-002";
      return undefined;
    }) as unknown as Request["header"];
    const result = extractForwardHeaders(req);
    expect(result["authorization"]).toBeUndefined();
    expect(result["x-tenant-id"]).toBe("tenant-002");
  });

  it("应包含 content-type 与 accept-language", () => {
    const req = createMockRequest();
    req.header = vi.fn((name: string) => {
      const map: Record<string, string> = {
        "content-type": "application/json",
        "accept-language": "zh-CN",
      };
      return map[name] ?? undefined;
    }) as unknown as Request["header"];
    const result = extractForwardHeaders(req);
    expect(result["content-type"]).toBe("application/json");
    expect(result["accept-language"]).toBe("zh-CN");
  });

  it("应包含幂等键 header", () => {
    const req = createMockRequest();
    req.header = vi.fn((name: string) => {
      if (name === "idempotency-key") return "idem-001";
      return undefined;
    }) as unknown as Request["header"];
    const result = extractForwardHeaders(req);
    expect(result["idempotency-key"]).toBe("idem-001");
  });
});

describe("normalizeQuery", () => {
  it("string 类型应原样保留", () => {
    const result = normalizeQuery({ page: "1", name: "abc" });
    expect(result).toEqual({ page: "1", name: "abc" });
  });

  it("string[] 类型应保留数组", () => {
    const result = normalizeQuery({ ids: ["1", "2", "3"] });
    expect(result).toEqual({ ids: ["1", "2", "3"] });
  });

  it("string[] 中混入非字符串应过滤", () => {
    const result = normalizeQuery({
      ids: ["1", 2 as unknown as string, "3", null as unknown as string],
    });
    expect(result).toEqual({ ids: ["1", "3"] });
  });

  it("number 类型应被丢弃（非 string/string[]）", () => {
    const result = normalizeQuery({ page: 1, size: 20 });
    expect(result).toEqual({});
  });

  it("null / undefined 应被丢弃", () => {
    const result = normalizeQuery({
      page: null,
      name: undefined,
      valid: "ok",
    });
    expect(result).toEqual({ valid: "ok" });
  });

  it("空对象应返回空对象", () => {
    expect(normalizeQuery({})).toEqual({});
  });

  it("query 为 undefined 应返回空对象", () => {
    expect(normalizeQuery(undefined)).toEqual({});
  });

  it("对象类型应被丢弃", () => {
    const result = normalizeQuery({
      filter: { name: "x" } as unknown as string,
    });
    expect(result).toEqual({});
  });
});

describe("SchemaMatchRule 类型与匹配行为", () => {
  // 类型层面的契约验证：SchemaMatchRule 应可构造
  const exampleSchema: ZodType<unknown> = z.object({ id: z.string() });

  it("SchemaMatchRule 应包含 method/pathRegex/schema/operation 字段", () => {
    const rule: SchemaMatchRule = {
      method: "GET",
      pathRegex: /^\/api\/v1\/iam\/principals$/,
      schema: exampleSchema,
      operation: "listPrincipals",
    };
    expect(rule.method).toBe("GET");
    expect(rule.operation).toBe("listPrincipals");
    expect(rule.pathRegex).toBeInstanceOf(RegExp);
    expect(rule.schema).toBe(exampleSchema);
  });

  it("pathRegex 应能精确匹配路径", () => {
    const rule: SchemaMatchRule = {
      method: "POST",
      pathRegex: /^\/api\/v1\/iam\/principals$/,
      schema: exampleSchema,
      operation: "createPrincipal",
    };
    expect(rule.pathRegex.test("/api/v1/iam/principals")).toBe(true);
    expect(rule.pathRegex.test("/api/v1/iam/principals/123")).toBe(false);
    expect(rule.pathRegex.test("/api/v1/iam/organizations")).toBe(false);
  });
});

// 端到端验证 proxyWithValidation：forward + 2xx 时严格验证
describe("proxyWithValidation", () => {
  const principalSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    displayName: z.string(),
  });

  const rules: readonly SchemaMatchRule[] = [
    {
      method: "GET",
      pathRegex: /^\/api\/v1\/iam\/principals\/[^/]+$/,
      schema: principalSchema,
      operation: "getPrincipal",
    },
  ];

  function createMockProxyService(result: ProxyResult) {
    return {
      forward: vi.fn().mockResolvedValue(result),
    };
  }

  function createMockSchemaValidator(
    extractImpl?: (r: ProxyResult) => unknown,
  ) {
    return {
      extractBusinessData: vi.fn(
        extractImpl ??
          ((r: ProxyResult) =>
            (r.data as { data?: unknown } | undefined)?.data),
      ),
      validateStrict: vi.fn((data: unknown) => data),
      writeBackBusinessData: vi.fn(),
    };
  }

  function makeResponse(status: number, data: unknown): ProxyResult {
    return {
      status,
      headers: {},
      data,
    } as unknown as ProxyResult;
  }

  it("2xx 响应且匹配规则时应调用 validateStrict", async () => {
    // Arrange
    const data = { id: "p-001", email: "u@example.com", displayName: "U" };
    const result = makeResponse(200, { code: 0, data, traceId: "t-1" });
    const proxyService = createMockProxyService(result);
    const schemaValidator = createMockSchemaValidator();

    const req = createMockRequest({
      method: "GET",
      originalUrl: "/api/v1/iam/principals/p-001",
    });

    // Act
    await proxyWithValidation(
      req,
      proxyService as unknown as Parameters<typeof proxyWithValidation>[1],
      schemaValidator as unknown as Parameters<typeof proxyWithValidation>[2],
      rules,
    );

    // Assert
    expect(proxyService.forward).toHaveBeenCalledTimes(1);
    expect(schemaValidator.extractBusinessData).toHaveBeenCalledWith(result);
    expect(schemaValidator.validateStrict).toHaveBeenCalledTimes(1);
    const [argData, argSchema, argCtx] =
      schemaValidator.validateStrict.mock.calls[0]!;
    expect(argData).toEqual(data);
    expect(argSchema).toBe(principalSchema);
    expect(argCtx).toEqual({
      domain: "iam",
      operation: "getPrincipal",
      traceId: "trace-test-001",
      downstreamService: "core-service",
    });
    expect(schemaValidator.writeBackBusinessData).toHaveBeenCalledWith(
      result,
      data,
    );
  });

  it("非 2xx 响应应跳过验证（不调用 extractBusinessData）", async () => {
    // Arrange
    const result = makeResponse(502, { error: "bad gateway" });
    const proxyService = createMockProxyService(result);
    const schemaValidator = createMockSchemaValidator();

    const req = createMockRequest({
      method: "GET",
      originalUrl: "/api/v1/iam/principals/p-001",
    });

    // Act
    await proxyWithValidation(
      req,
      proxyService as unknown as Parameters<typeof proxyWithValidation>[1],
      schemaValidator as unknown as Parameters<typeof proxyWithValidation>[2],
      rules,
    );

    // Assert
    expect(proxyService.forward).toHaveBeenCalledTimes(1);
    expect(schemaValidator.extractBusinessData).not.toHaveBeenCalled();
    expect(schemaValidator.validateStrict).not.toHaveBeenCalled();
  });

  it("无匹配规则时应跳过验证", async () => {
    // Arrange
    const data = { items: [] };
    const result = makeResponse(200, { code: 0, data, traceId: "t-1" });
    const proxyService = createMockProxyService(result);
    const schemaValidator = createMockSchemaValidator();

    // 路径不在 rules 中
    const req = createMockRequest({
      method: "POST",
      originalUrl: "/api/v1/iam/principals",
    });

    // Act
    await proxyWithValidation(
      req,
      proxyService as unknown as Parameters<typeof proxyWithValidation>[1],
      schemaValidator as unknown as Parameters<typeof proxyWithValidation>[2],
      rules,
    );

    // Assert
    expect(proxyService.forward).toHaveBeenCalledTimes(1);
    expect(schemaValidator.extractBusinessData).not.toHaveBeenCalled();
  });

  it("列表响应（数组）应跳过严格验证", async () => {
    // Arrange
    const data = [{ id: "p-001", email: "u@example.com", displayName: "U" }];
    const result = makeResponse(200, { code: 0, data, traceId: "t-1" });
    const proxyService = createMockProxyService(result);
    const schemaValidator = createMockSchemaValidator();

    // 调整规则以匹配 list 端点
    const listRules: readonly SchemaMatchRule[] = [
      {
        method: "GET",
        pathRegex: /^\/api\/v1\/iam\/principals$/,
        schema: principalSchema,
        operation: "listPrincipals",
      },
    ];

    const req = createMockRequest({
      method: "GET",
      originalUrl: "/api/v1/iam/principals",
    });

    // Act
    await proxyWithValidation(
      req,
      proxyService as unknown as Parameters<typeof proxyWithValidation>[1],
      schemaValidator as unknown as Parameters<typeof proxyWithValidation>[2],
      listRules,
    );

    // Assert
    expect(schemaValidator.extractBusinessData).toHaveBeenCalledWith(result);
    expect(schemaValidator.validateStrict).not.toHaveBeenCalled();
  });

  it("自定义 domain 应透传到 ValidationContext", async () => {
    // Arrange
    const data = { id: "p-001", email: "u@example.com", displayName: "U" };
    const result = makeResponse(200, { code: 0, data, traceId: "t-1" });
    const proxyService = createMockProxyService(result);
    const schemaValidator = createMockSchemaValidator();

    const req = createMockRequest({
      method: "GET",
      originalUrl: "/api/v1/iam/principals/p-001",
    });

    // Act
    await proxyWithValidation(
      req,
      proxyService as unknown as Parameters<typeof proxyWithValidation>[1],
      schemaValidator as unknown as Parameters<typeof proxyWithValidation>[2],
      rules,
      "custom-domain",
    );

    // Assert
    expect(schemaValidator.validateStrict).toHaveBeenCalledTimes(1);
    const [, , argCtx] = schemaValidator.validateStrict.mock.calls[0]!;
    expect(argCtx).toEqual(
      expect.objectContaining({ domain: "custom-domain" }),
    );
  });
});
