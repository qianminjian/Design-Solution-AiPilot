import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { HttpHeader } from "@design-platform/shared";
import { TraceIdMiddleware } from "../../../src/middleware/trace-id.middleware";

/**
 * 构造 Express Request mock
 */
function createRequest(headers: Record<string, string> = {}): Request {
  return {
    header: vi.fn((name: string) => headers[name.toLowerCase()]),
    headers: Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    ),
    method: "GET",
    url: "/api/v1/test",
  } as unknown as Request;
}

/**
 * 构造 Express Response mock
 */
function createResponse(): Response {
  const headers: Record<string, string> = {};
  return {
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
      return {} as Response;
    }),
    getHeader: vi.fn((name: string) => headers[name]),
  } as unknown as Response & { __headers: Record<string, string> };
}

describe("TraceIdMiddleware", () => {
  it("应该在请求头存在 x-trace-id 时透传该值到响应头", () => {
    // Arrange
    const middleware = new TraceIdMiddleware();
    const traceId = "550e8400-e29b-41d4-a716-446655440000";
    const request = createRequest({ [HttpHeader.X_TRACE_ID]: traceId });
    const response = createResponse();
    const next: NextFunction = vi.fn();

    // Act
    middleware.use(request as Request, response, next);

    // Assert
    expect(response.setHeader).toHaveBeenCalledWith(
      HttpHeader.X_TRACE_ID,
      traceId,
    );
    expect(request.traceId).toBe(traceId);
    expect(next).toHaveBeenCalledOnce();
  });

  it("应该在请求头缺失 x-trace-id 时生成新的 UUID 并写入响应头", () => {
    // Arrange
    const middleware = new TraceIdMiddleware();
    const request = createRequest({});
    const response = createResponse();
    const next: NextFunction = vi.fn();

    // Act
    middleware.use(request as Request, response, next);

    // Assert
    expect(request.traceId).toBeTruthy();
    // UUID 长度 36，包含 4 个连字符
    expect(request.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      HttpHeader.X_TRACE_ID,
      request.traceId,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("应该在 x-trace-id 为空字符串时生成新的 UUID", () => {
    // Arrange
    const middleware = new TraceIdMiddleware();
    const request = createRequest({ [HttpHeader.X_TRACE_ID]: "" });
    const response = createResponse();
    const next: NextFunction = vi.fn();

    // Act
    middleware.use(request as Request, response, next);

    // Assert
    expect(request.traceId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(request.traceId).not.toBe("");
  });

  it("应该在 x-trace-id 仅含空白字符时生成新的 UUID", () => {
    // Arrange
    const middleware = new TraceIdMiddleware();
    const request = createRequest({ [HttpHeader.X_TRACE_ID]: "   " });
    const response = createResponse();
    const next: NextFunction = vi.fn();

    // Act
    middleware.use(request as Request, response, next);

    // Assert
    expect(request.traceId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(request.traceId).not.toBe("   ");
  });

  it("应该调用 next() 将控制权传递给下一个中间件", () => {
    // Arrange
    const middleware = new TraceIdMiddleware();
    const request = createRequest({});
    const response = createResponse();
    const next: NextFunction = vi.fn();

    // Act
    middleware.use(request as Request, response, next);

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("生成的 UUID 应唯一（不同请求生成不同值）", () => {
    // Arrange
    const middleware = new TraceIdMiddleware();
    const request1 = createRequest({});
    const request2 = createRequest({});
    const response1 = createResponse();
    const response2 = createResponse();

    // Act
    middleware.use(request1 as Request, response1, vi.fn());
    middleware.use(request2 as Request, response2, vi.fn());

    // Assert
    expect(request1.traceId).not.toBe(request2.traceId);
  });

  it("生成的 UUID 应符合 randomUUID 格式", () => {
    // Arrange
    const middleware = new TraceIdMiddleware();
    const request = createRequest({});
    const response = createResponse();

    // Act
    middleware.use(request as Request, response, vi.fn());

    // Assert：与 node:crypto randomUUID 输出对比格式
    const referenceUuid = randomUUID();
    expect(request.traceId).toHaveLength(referenceUuid.length);
  });
});
