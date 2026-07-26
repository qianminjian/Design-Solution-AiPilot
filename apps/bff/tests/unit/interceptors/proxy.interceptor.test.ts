import { describe, it, expect, vi } from "vitest";
import { of, throwError, firstValueFrom } from "rxjs";
import type { Request, Response } from "express";
import { HttpHeader } from "@design-platform/shared";
import {
  ProxyInterceptor,
  type ProxyResult,
} from "../../../src/interceptors/proxy.interceptor";
import type { ExecutionContext, CallHandler } from "@nestjs/common";

/**
 * 构造 Express Request mock
 */
function createRequest(headers: Record<string, string> = {}): Request & {
  traceId?: string;
} {
  return {
    header: vi.fn((name: string) => headers[name.toLowerCase()]),
    headers: Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    ),
    method: "GET",
    url: "/api/v1/test",
    traceId: headers[HttpHeader.X_TRACE_ID.toLowerCase()],
  } as unknown as Request & { traceId?: string };
}

/**
 * 构造 Express Response mock，记录 status 与 setHeader 调用
 */
function createResponse(): Response {
  const headers: Record<string, string> = {};
  return {
    status: vi.fn(() => ({}) as Response),
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
      return {} as Response;
    }),
    getHeader: vi.fn((name: string) => headers[name]),
  } as unknown as Response;
}

/**
 * 构造 NestJS ExecutionContext mock
 */
function createExecutionContext(
  request: Request,
  response: Response,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getType: () => "http",
  } as unknown as ExecutionContext;
}

/**
 * 构造 CallHandler mock，返回指定的 Observable
 */
function createCallHandler<T>(result: T): CallHandler<T> {
  return {
    handle: () => of(result),
  } as unknown as CallHandler<T>;
}

/**
 * 构造抛错的 CallHandler mock
 */
function createErrorCallHandler<T>(error: unknown): CallHandler<T> {
  return {
    handle: () => throwError(() => error),
  } as unknown as CallHandler<T>;
}

describe("ProxyInterceptor", () => {
  const interceptor = new ProxyInterceptor();

  describe("成功响应（2xx）", () => {
    it("应该透传下游状态码与业务相关响应头（ETag/Content-Type）", async () => {
      const request = createRequest({
        [HttpHeader.X_TRACE_ID]: "trace-success",
      });
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const proxyResult: ProxyResult = {
        status: 200,
        data: { code: 0, data: { id: "p1" }, message: null, traceId: "t1" },
        headers: {
          etag: '"v1"',
          "content-type": "application/json",
        },
      };
      const next = createCallHandler(proxyResult);

      const data = await firstValueFrom(interceptor.intercept(ctx, next));

      // 应返回下游响应体
      expect(data).toEqual(proxyResult.data);
      // 应设置下游状态码
      expect(response.status).toHaveBeenCalledWith(200);
      // 应透传业务相关响应头
      expect(response.setHeader).toHaveBeenCalledWith("etag", '"v1"');
      expect(response.setHeader).toHaveBeenCalledWith(
        "content-type",
        "application/json",
      );
    });

    it("应该过滤 hop-by-hop 头（content-length/transfer-encoding/connection）", async () => {
      const request = createRequest();
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const proxyResult: ProxyResult = {
        status: 200,
        data: { code: 0, data: null, message: null },
        headers: {
          "content-length": "123",
          "transfer-encoding": "chunked",
          connection: "keep-alive",
          "content-type": "application/json",
        },
      };
      const next = createCallHandler(proxyResult);

      await firstValueFrom(interceptor.intercept(ctx, next));

      expect(response.setHeader).toHaveBeenCalledWith(
        "content-type",
        "application/json",
      );
      // 不应透传 hop-by-hop 头
      expect(response.setHeader).not.toHaveBeenCalledWith(
        "content-length",
        expect.anything(),
      );
      expect(response.setHeader).not.toHaveBeenCalledWith(
        "transfer-encoding",
        expect.anything(),
      );
      expect(response.setHeader).not.toHaveBeenCalledWith(
        "connection",
        expect.anything(),
      );
    });

    it("应该过滤值为空字符串的响应头", async () => {
      const request = createRequest();
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const proxyResult: ProxyResult = {
        status: 200,
        data: { code: 0, data: null, message: null },
        headers: {
          "x-empty": "",
          "x-valid": "ok",
        },
      };
      const next = createCallHandler(proxyResult);

      await firstValueFrom(interceptor.intercept(ctx, next));

      expect(response.setHeader).toHaveBeenCalledWith("x-valid", "ok");
      expect(response.setHeader).not.toHaveBeenCalledWith(
        "x-empty",
        expect.anything(),
      );
    });

    it("非 ProxyResult 返回值应原样透传（不调用 status/setHeader）", async () => {
      const request = createRequest();
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const next = createCallHandler({ unexpected: true });

      const data = await firstValueFrom(interceptor.intercept(ctx, next));

      expect(data).toEqual({ unexpected: true });
      expect(response.status).not.toHaveBeenCalled();
      expect(response.setHeader).not.toHaveBeenCalled();
    });
  });

  describe("错误响应（4xx/5xx）", () => {
    it("应该将 Java ApiResponse.error 转换为 ApiErrorResponse 格式", async () => {
      const request = createRequest({
        [HttpHeader.X_TRACE_ID]: "trace-error",
      });
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const proxyResult: ProxyResult = {
        status: 401,
        data: {
          code: 401,
          data: null,
          message: "Access token 已失效",
          traceId: "biz-trace",
        },
        headers: { "content-type": "application/json" },
      };
      const next = createCallHandler(proxyResult);

      const data = await firstValueFrom(interceptor.intercept(ctx, next));
      const problem = data as Record<string, unknown>;

      // 应转换为 ApiErrorResponse 格式
      expect(problem.status).toBe(401);
      expect(problem.code).toBe(401);
      expect(problem.errorCode).toBe("401");
      expect(problem.title).toBe("Unauthorized");
      expect(problem.detail).toBe("Access token 已失效");
      expect(problem.correlationId).toBe("biz-trace");
      expect(problem.retryable).toBe(false);
    });

    it("5xx 错误应标记 retryable=true", async () => {
      const request = createRequest();
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const proxyResult: ProxyResult = {
        status: 500,
        data: { code: 500, data: null, message: "下游异常" },
        headers: {},
      };
      const next = createCallHandler(proxyResult);

      const data = await firstValueFrom(interceptor.intercept(ctx, next));
      const problem = data as Record<string, unknown>;
      expect(problem.retryable).toBe(true);
    });

    it("429 错误应标记 retryable=true", async () => {
      const request = createRequest();
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const proxyResult: ProxyResult = {
        status: 429,
        data: { code: 429, data: null, message: "Too Many Requests" },
        headers: {},
      };
      const next = createCallHandler(proxyResult);

      const data = await firstValueFrom(interceptor.intercept(ctx, next));
      const problem = data as Record<string, unknown>;
      expect(problem.retryable).toBe(true);
    });

    it("404 错误应标记 retryable=false", async () => {
      const request = createRequest();
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const proxyResult: ProxyResult = {
        status: 404,
        data: { code: 404, data: null, message: "Resource not found" },
        headers: {},
      };
      const next = createCallHandler(proxyResult);

      const data = await firstValueFrom(interceptor.intercept(ctx, next));
      const problem = data as Record<string, unknown>;
      expect(problem.retryable).toBe(false);
      expect(problem.title).toBe("Not Found");
    });

    it("未知状态码应使用默认 title 'Internal Server Error'", async () => {
      const request = createRequest();
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const proxyResult: ProxyResult = {
        status: 599,
        data: { code: 599, data: null, message: "Network read timeout" },
        headers: {},
      };
      const next = createCallHandler(proxyResult);

      const data = await firstValueFrom(interceptor.intercept(ctx, next));
      const problem = data as Record<string, unknown>;
      expect(problem.title).toBe("Internal Server Error");
    });

    it("应该使用 request.traceId 作为 correlationId 兜底", async () => {
      const request = createRequest({
        [HttpHeader.X_TRACE_ID]: "fallback-trace-id",
      });
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const proxyResult: ProxyResult = {
        status: 401,
        // data 中无 traceId 字段，应兜底使用 request 的 traceId
        data: { code: 401, data: null, message: "Unauthorized" },
        headers: {},
      };
      const next = createCallHandler(proxyResult);

      const data = await firstValueFrom(interceptor.intercept(ctx, next));
      const problem = data as Record<string, unknown>;
      expect(problem.correlationId).toBe("fallback-trace-id");
    });

    it("非 ApiResponse 格式（无 code 字段）应原样透传 data", async () => {
      const request = createRequest();
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const proxyResult: ProxyResult = {
        status: 500,
        data: { unexpected: true },
        headers: {},
      };
      const next = createCallHandler(proxyResult);

      const data = await firstValueFrom(interceptor.intercept(ctx, next));
      // 非 ApiResponse 格式，应原样返回 data
      expect(data).toEqual({ unexpected: true });
    });
  });

  describe("下游异常（throwError）", () => {
    it("AxiosError 应原样透传", async () => {
      const request = createRequest({
        [HttpHeader.X_TRACE_ID]: "trace-axios",
      });
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const axiosError = {
        isAxiosError: true,
        message: "ETIMEDOUT",
        code: "ETIMEDOUT",
        response: { status: 504, data: { message: "Gateway Timeout" } },
      };
      const next = createErrorCallHandler(axiosError);

      await expect(
        firstValueFrom(interceptor.intercept(ctx, next)),
      ).rejects.toBe(axiosError);
    });

    it("普通 Error 应在 message 中附加 traceId", async () => {
      const request = createRequest({
        [HttpHeader.X_TRACE_ID]: "trace-error-attach",
      });
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const originalError = new Error("原始错误");
      const next = createErrorCallHandler(originalError);

      await expect(
        firstValueFrom(interceptor.intercept(ctx, next)),
      ).rejects.toThrow(/traceId=trace-error-attach/);
    });

    it("非 Error 类型异常应原样透传", async () => {
      const request = createRequest();
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const stringError = "string error";
      const next = createErrorCallHandler(stringError);

      await expect(
        firstValueFrom(interceptor.intercept(ctx, next)),
      ).rejects.toBe(stringError);
    });
  });

  describe("traceId 来源优先级", () => {
    it("应优先使用 request.traceId", async () => {
      const request = createRequest({
        [HttpHeader.X_TRACE_ID]: "header-trace",
      });
      // 显式覆盖 traceId 字段
      (request as { traceId?: string }).traceId = "request-trace";
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const proxyResult: ProxyResult = {
        status: 401,
        data: { code: 401, data: null, message: "Unauthorized" },
        headers: {},
      };
      const next = createCallHandler(proxyResult);

      const data = await firstValueFrom(interceptor.intercept(ctx, next));
      const problem = data as Record<string, unknown>;
      expect(problem.correlationId).toBe("request-trace");
    });

    it("traceId 缺失时应使用 'unknown'", async () => {
      const request = createRequest();
      const response = createResponse();
      const ctx = createExecutionContext(request, response);
      const proxyResult: ProxyResult = {
        status: 500,
        data: { code: 500, data: null, message: "Internal Error" },
        headers: {},
      };
      const next = createCallHandler(proxyResult);

      const data = await firstValueFrom(interceptor.intercept(ctx, next));
      const problem = data as Record<string, unknown>;
      expect(problem.correlationId).toBe("unknown");
    });
  });
});
