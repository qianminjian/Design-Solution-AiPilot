/**
 * API Client 单元测试
 *
 * 验证：
 *  - 成功响应（HTTP 2xx + code=0）返回 data
 *  - HTTP 错误（4xx/5xx）抛 ApiError
 *  - 业务错误（code≠0）抛 ApiError
 *  - 响应体不符合 Problem Details 规范时构造兜底错误
 *  - schema 验证（软/严格）
 *  - traceId 自动生成与透传
 *  - Authorization Header 注入
 *  - 请求体序列化（JSON/FormData/Blob）
 *  - 便捷方法 apiGet/apiPost/apiPut/apiPatch/apiDelete
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  ApiError,
  apiRequest,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
} from "@/lib/api-client";
import {
  resetSchemaValidationFailures,
  setSentryReporter,
} from "@/lib/schema-validator";

import type { ApiErrorResponse } from "@design-platform/shared";

// ── 公共 fixture ──

const successResponse = <T>(data: T, traceId = "test-trace-id") => ({
  code: 0,
  data,
  message: null,
  traceId,
});

const errorResponse: ApiErrorResponse = {
  code: 401,
  errorCode: "AUTHENTICATION_REQUIRED",
  status: 401,
  title: "Unauthorized",
  detail: "Access token 已失效",
  correlationId: "test-trace-id",
  retryable: false,
};

// ── fetch mock 工具 ──

function mockFetchOnce(payload: unknown, init?: ResponseInit): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
        ...init,
      }),
    ),
  );
}

function mockFetchResponse(payload: unknown, init?: ResponseInit): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
        ...init,
      }),
    ),
  );
}

function mockFetchJsonFail(status: number, statusText?: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce(
      new Response("not-json", {
        status,
        statusText: statusText ?? "HTTP Error",
        headers: { "Content-Type": "text/plain" },
      }),
    ),
  );
}

describe("api-client", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    resetSchemaValidationFailures();
    setSentryReporter(null);
    // 重置 cookie
    if (typeof document !== "undefined") {
      document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    vi.unstubAllGlobals();
    resetSchemaValidationFailures();
    setSentryReporter(null);
  });

  // ── 成功响应 ──

  describe("成功响应", () => {
    it("应该返回 ApiResponse.data 字段", async () => {
      mockFetchOnce(successResponse({ id: "u-001", name: "张三" }));

      const result = await apiRequest<{ id: string; name: string }>(
        "/users/me",
      );

      expect(result).toEqual({ id: "u-001", name: "张三" });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("应该接受 data 为 null 的成功响应", async () => {
      mockFetchOnce(successResponse(null));

      const result = await apiRequest<null>("/logout");

      expect(result).toBeNull();
    });

    it("应该接受 data 为数组的成功响应", async () => {
      mockFetchOnce(successResponse([{ id: "1" }, { id: "2" }]));

      const result = await apiRequest<Array<{ id: string }>>("/users");

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("1");
    });
  });

  // ── HTTP 错误 ──

  describe("HTTP 错误", () => {
    it("HTTP 4xx + Problem Details 应抛 ApiError 携带 errorCode", async () => {
      mockFetchOnce(errorResponse, { status: 401 });

      try {
        await apiRequest("/users/me");
        expect.fail("应抛 ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const e = error as ApiError;
        expect(e.errorCode).toBe("AUTHENTICATION_REQUIRED");
        expect(e.status).toBe(401);
        expect(e.retryable).toBe(false);
        expect(e.traceId).toBe("test-trace-id");
      }
    });

    it("HTTP 5xx + Problem Details 应标记 retryable=true", async () => {
      const serverError: ApiErrorResponse = {
        code: 500,
        errorCode: "INTERNAL_ERROR",
        status: 500,
        title: "Internal Server Error",
        detail: "下游服务异常",
        correlationId: "trace-500",
        retryable: true,
      };
      mockFetchOnce(serverError, { status: 500 });

      try {
        await apiRequest("/users/me");
        expect.fail("应抛 ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const e = error as ApiError;
        expect(e.status).toBe(500);
        expect(e.retryable).toBe(true);
      }
    });

    it("HTTP 错误但响应体非 JSON 应构造兜底 ApiError", async () => {
      mockFetchJsonFail(502, "Bad Gateway");

      try {
        await apiRequest("/users/me");
        expect.fail("应抛 ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const e = error as ApiError;
        expect(e.status).toBe(502);
        expect(e.errorCode).toBe("INTERNAL_ERROR");
        expect(e.retryable).toBe(true); // 5xx 应可重试
      }
    });

    it("HTTP 429 应标记 retryable=true", async () => {
      mockFetchJsonFail(429, "Too Many Requests");

      try {
        await apiRequest("/users/me");
        expect.fail("应抛 ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const e = error as ApiError;
        expect(e.status).toBe(429);
        expect(e.retryable).toBe(true);
      }
    });

    it("HTTP 404 应标记 retryable=false", async () => {
      mockFetchJsonFail(404, "Not Found");

      try {
        await apiRequest("/users/unknown");
        expect.fail("应抛 ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const e = error as ApiError;
        expect(e.status).toBe(404);
        expect(e.retryable).toBe(false);
      }
    });
  });

  // ── 业务错误 ──

  describe("业务错误（HTTP 200 但 code≠0）", () => {
    it("应该抛 ApiError 携带 INTERNAL_ERROR", async () => {
      const businessError = {
        code: 1001,
        data: null,
        message: "项目不存在",
        traceId: "biz-trace",
      };
      mockFetchOnce(businessError);

      try {
        await apiRequest("/projects/unknown");
        expect.fail("应抛 ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const e = error as ApiError;
        expect(e.errorCode).toBe("INTERNAL_ERROR");
        expect(e.status).toBe(200);
        expect(e.retryable).toBe(false);
      }
    });

    it("响应体完全为 null 应抛 ApiError", async () => {
      mockFetchOnce(null);

      try {
        await apiRequest("/users/me");
        expect.fail("应抛 ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const e = error as ApiError;
        expect(e.errorCode).toBe("INTERNAL_ERROR");
        expect(e.status).toBe(200);
      }
    });
  });

  // ── schema 验证 ──

  describe("schema 验证", () => {
    const userSchema = z.object({
      id: z.string(),
      email: z.string().email(),
    });

    it("软验证：合法数据应返回解析后的数据", async () => {
      mockFetchOnce(
        successResponse({ id: "u-001", email: "user@example.com" }),
      );

      const result = await apiRequest<{ id: string; email: string }>(
        "/users/me",
        {
          validate: {
            schema: userSchema,
            context: "test.valid.soft",
          },
        },
      );

      expect(result).toEqual({ id: "u-001", email: "user@example.com" });
    });

    it("软验证：非法数据应透传原数据并记录 console.warn", async () => {
      mockFetchOnce(successResponse({ id: "u-001", email: "not-an-email" }));

      const result = await apiRequest<{ id: string; email: string }>(
        "/users/me",
        {
          validate: {
            schema: userSchema,
            context: "test.invalid.soft",
          },
        },
      );

      // 透传原数据
      expect(result).toEqual({ id: "u-001", email: "not-an-email" });
      // 应记录 console.warn
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("严格验证：合法数据应返回解析后的数据", async () => {
      mockFetchOnce(
        successResponse({ id: "u-001", email: "user@example.com" }),
      );

      const result = await apiRequest<{ id: string; email: string }>(
        "/users/me",
        {
          validate: {
            schema: userSchema,
            context: "test.valid.strict",
            strict: true,
          },
        },
      );

      expect(result).toEqual({ id: "u-001", email: "user@example.com" });
    });

    it("严格验证：非法数据应抛 ResponseValidationError", async () => {
      mockFetchOnce(successResponse({ id: "u-001", email: "not-an-email" }));

      await expect(
        apiRequest<{ id: string; email: string }>("/users/me", {
          validate: {
            schema: userSchema,
            context: "test.invalid.strict",
            strict: true,
          },
        }),
      ).rejects.toThrow(); // ResponseValidationError
    });

    it("未提供 validate 选项时应跳过验证直接返回 data", async () => {
      mockFetchOnce(successResponse({ id: "u-001", email: "not-an-email" }));

      const result = await apiRequest<{ id: string; email: string }>(
        "/users/me",
      );

      expect(result).toEqual({ id: "u-001", email: "not-an-email" });
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  // ── traceId 透传 ──

  describe("traceId 透传", () => {
    it("未提供 traceId 时应自动生成 UUID 注入 x-trace-id Header", async () => {
      mockFetchOnce(successResponse({ ok: true }));

      await apiRequest("/health");

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("x-trace-id")).toBeTruthy();
      // 应为 UUID 格式
      expect(headers.get("x-trace-id")).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("提供 traceId 时应使用提供的值", async () => {
      mockFetchOnce(successResponse({ ok: true }));

      await apiRequest("/health", { traceId: "provided-trace-id" });

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("x-trace-id")).toBe("provided-trace-id");
    });

    it("customHeaders 中已设置 x-trace-id 时应保留原值", async () => {
      mockFetchOnce(successResponse({ ok: true }));

      await apiRequest("/health", {
        headers: { "x-trace-id": "custom-trace-id" },
      });

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("x-trace-id")).toBe("custom-trace-id");
    });
  });

  // ── Authorization Header ──

  describe("Authorization Header", () => {
    it("cookie 中存在 access_token 时应注入 Authorization Bearer", async () => {
      mockFetchOnce(successResponse({ ok: true }));
      // 设置 cookie
      document.cookie = "access_token=test-token-123";

      await apiRequest("/users/me");

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("authorization")).toBe("Bearer test-token-123");

      // 清理 cookie
      document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    });

    it("cookie 中无 access_token 时不应注入 Authorization", async () => {
      mockFetchOnce(successResponse({ ok: true }));

      await apiRequest("/health");

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("authorization")).toBeNull();
    });
  });

  // ── 请求体序列化 ──

  describe("请求体序列化", () => {
    it("普通对象应自动 JSON 序列化并设置 Content-Type", async () => {
      mockFetchOnce(successResponse({ ok: true }));

      await apiRequest("/users", {
        method: "POST",
        body: { name: "张三", age: 28 },
      });

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("content-type")).toBe("application/json");
      expect(requestInit.body).toBe(JSON.stringify({ name: "张三", age: 28 }));
    });

    it("FormData 不应被 JSON 序列化，不设置 Content-Type", async () => {
      mockFetchOnce(successResponse({ ok: true }));
      const formData = new FormData();
      formData.append("file", "content");

      await apiRequest("/upload", {
        method: "POST",
        body: formData,
      });

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("content-type")).toBeNull();
      expect(requestInit.body).toBe(formData);
    });

    it("Blob 不应被 JSON 序列化", async () => {
      mockFetchOnce(successResponse({ ok: true }));
      const blob = new Blob(["binary content"], {
        type: "application/octet-stream",
      });

      await apiRequest("/upload", {
        method: "POST",
        body: blob,
      });

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      expect(requestInit.body).toBe(blob);
    });

    it("body 为 null 时不应设置 Content-Type", async () => {
      mockFetchOnce(successResponse({ ok: true }));

      await apiRequest("/users", { method: "POST", body: null });

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("content-type")).toBeNull();
      expect(requestInit.body).toBeUndefined();
    });

    it("body 为 undefined 时不应设置 Content-Type", async () => {
      mockFetchOnce(successResponse({ ok: true }));

      await apiRequest("/users", { method: "POST" });

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("content-type")).toBeNull();
    });

    it("skipJsonContentType=true 时不设置 Content-Type", async () => {
      mockFetchOnce(successResponse({ ok: true }));

      await apiRequest("/users", {
        method: "POST",
        body: { name: "张三" },
        skipJsonContentType: true,
      });

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("content-type")).toBeNull();
      // 但 body 仍应被 JSON 序列化
      expect(requestInit.body).toBe(JSON.stringify({ name: "张三" }));
    });
  });

  // ── 便捷方法 ──

  describe("便捷方法", () => {
    it("apiGet 应使用 GET 方法", async () => {
      mockFetchResponse(successResponse({ ok: true }));

      await apiGet("/users/me");

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      expect(requestInit.method).toBe("GET");
    });

    it("apiPost 应使用 POST 方法并序列化 body", async () => {
      mockFetchResponse(successResponse({ ok: true }));

      await apiPost("/users", { name: "张三" });

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      expect(requestInit.method).toBe("POST");
      expect(requestInit.body).toBe(JSON.stringify({ name: "张三" }));
    });

    it("apiPut 应使用 PUT 方法并序列化 body", async () => {
      mockFetchResponse(successResponse({ ok: true }));

      await apiPut("/users/u-001", { name: "李四" });

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      expect(requestInit.method).toBe("PUT");
      expect(requestInit.body).toBe(JSON.stringify({ name: "李四" }));
    });

    it("apiPatch 应使用 PATCH 方法并序列化 body", async () => {
      mockFetchResponse(successResponse({ ok: true }));

      await apiPatch("/users/u-001", { name: "王五" });

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      expect(requestInit.method).toBe("PATCH");
      expect(requestInit.body).toBe(JSON.stringify({ name: "王五" }));
    });

    it("apiDelete 应使用 DELETE 方法", async () => {
      mockFetchResponse(successResponse(null));

      await apiDelete("/users/u-001");

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      expect(requestInit.method).toBe("DELETE");
    });

    it("便捷方法应支持 schema 验证选项", async () => {
      mockFetchResponse(
        successResponse({ id: "u-001", email: "user@example.com" }),
      );

      const userSchema = z.object({
        id: z.string(),
        email: z.string().email(),
      });

      const result = await apiGet<{ id: string; email: string }>("/users/me", {
        validate: {
          schema: userSchema,
          context: "test.apiGet.validate",
        },
      });

      expect(result).toEqual({ id: "u-001", email: "user@example.com" });
    });

    it("便捷方法应支持 traceId 选项", async () => {
      mockFetchResponse(successResponse({ ok: true }));

      await apiGet("/health", { traceId: "method-trace-id" });

      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const requestInit = fetchCall?.[1] as RequestInit;
      const headers = new Headers(requestInit.headers);
      expect(headers.get("x-trace-id")).toBe("method-trace-id");
    });
  });

  // ── ApiError 类 ──

  describe("ApiError 类", () => {
    it("应该正确构造 ApiError 并继承 Error", () => {
      const error = new ApiError({
        code: 401,
        errorCode: "AUTHENTICATION_REQUIRED",
        status: 401,
        title: "Unauthorized",
        detail: "Access token 已失效",
        correlationId: "trace-001",
        retryable: false,
        errors: [{ code: "EXPIRED", pointer: "#/token", parameter: "token" }],
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe("ApiError");
      expect(error.errorCode).toBe("AUTHENTICATION_REQUIRED");
      expect(error.status).toBe(401);
      expect(error.traceId).toBe("trace-001");
      expect(error.retryable).toBe(false);
      expect(error.fieldErrors).toEqual([
        { code: "EXPIRED", pointer: "#/token", parameter: "token" },
      ]);
      // message 应优先使用 title
      expect(error.message).toBe("Unauthorized");
    });

    it("title 缺失时应使用 detail 作为 message", () => {
      const error = new ApiError({
        code: 500,
        errorCode: "INTERNAL_ERROR",
        status: 500,
        title: "",
        detail: "下游服务异常",
        correlationId: "trace-002",
        retryable: true,
      });

      expect(error.message).toBe("下游服务异常");
    });

    it("title 与 detail 均缺失时应使用 errorCode 作为 message", () => {
      const error = new ApiError({
        code: 500,
        errorCode: "INTERNAL_ERROR",
        status: 500,
        title: "",
        detail: "",
        correlationId: "trace-003",
        retryable: true,
      });

      expect(error.message).toBe("INTERNAL_ERROR");
    });
  });

  // ── 响应体非 JSON ──

  describe("响应体解析失败", () => {
    it("响应体非 JSON 且 HTTP 200 应抛 ApiError", async () => {
      mockFetchJsonFail(200, "OK");

      try {
        await apiRequest("/users/me");
        expect.fail("应抛 ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const e = error as ApiError;
        expect(e.errorCode).toBe("INTERNAL_ERROR");
        expect(e.status).toBe(200);
      }
    });
  });
});
