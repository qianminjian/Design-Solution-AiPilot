import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { LoggingMiddleware } from "../../../src/middleware/logging.middleware";
import { logger } from "../../../src/infra/logger";

/**
 * 构造 Express Request mock
 */
function createRequest(
  overrides: Partial<Request> & { traceId?: string } = {},
): Request & { traceId?: string } {
  return {
    method: "GET",
    url: "/api/v1/test",
    originalUrl: "/api/v1/test",
    traceId: undefined,
    ...overrides,
  } as unknown as Request & { traceId?: string };
}

/**
 * 构造 EventEmitter-based Response mock
 * - 支持 on/emit 触发 'finish' 事件
 * - 记录 statusCode
 */
function createResponse(statusCode = 200): Response & {
  __emitFinish: () => void;
} {
  const handlers: Record<string, Array<() => void>> = {};
  return {
    statusCode,
    on: vi.fn((event: string, cb: () => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(cb);
    }),
    emit: vi.fn((event: string) => {
      (handlers[event] ?? []).forEach((cb) => cb());
    }),
    __emitFinish: () => {
      (handlers["finish"] ?? []).forEach((cb) => cb());
    },
  } as unknown as Response & { __emitFinish: () => void };
}

describe("LoggingMiddleware", () => {
  let middleware: LoggingMiddleware;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    middleware = new LoggingMiddleware();
    infoSpy = vi
      .spyOn(logger, "info")
      .mockImplementation(() => undefined as never);
    warnSpy = vi
      .spyOn(logger, "warn")
      .mockImplementation(() => undefined as never);
    errorSpy = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("2xx 响应应使用 info 级别记录请求日志", () => {
    const request = createRequest({
      method: "GET",
      originalUrl: "/api/v1/projects",
      traceId: "trace-2xx",
    });
    const response = createResponse(200);
    const next: NextFunction = vi.fn();

    middleware.use(request, response, next);

    // 应立即调用 next
    expect(next).toHaveBeenCalledTimes(1);

    // 触发响应结束
    response.__emitFinish();

    // 应调用 logger.info
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const logCall = infoSpy.mock.calls[0];
    const payload = logCall?.[0] as Record<string, unknown>;
    const message = logCall?.[1] as string;
    expect(payload.method).toBe("GET");
    expect(payload.path).toBe("/api/v1/projects");
    expect(payload.status).toBe(200);
    expect(payload.traceId).toBe("trace-2xx");
    expect(typeof payload.duration).toBe("number");
    expect(message).toContain("GET");
    expect(message).toContain("/api/v1/projects");
    expect(message).toContain("200");
  });

  it("4xx 响应应使用 warn 级别记录请求日志", () => {
    const request = createRequest({
      method: "POST",
      originalUrl: "/api/v1/auth/login",
      traceId: "trace-4xx",
    });
    const response = createResponse(401);
    const next: NextFunction = vi.fn();

    middleware.use(request, response, next);
    response.__emitFinish();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    const payload = warnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.status).toBe(401);
  });

  it("5xx 响应应使用 error 级别记录请求日志", () => {
    const request = createRequest({
      method: "GET",
      originalUrl: "/api/v1/health",
      traceId: "trace-5xx",
    });
    const response = createResponse(500);
    const next: NextFunction = vi.fn();

    middleware.use(request, response, next);
    response.__emitFinish();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    const payload = errorSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.status).toBe(500);
  });

  it("502 响应（5xx）应使用 error 级别", () => {
    const request = createRequest();
    const response = createResponse(502);
    const next: NextFunction = vi.fn();

    middleware.use(request, response, next);
    response.__emitFinish();

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("429 响应（4xx）应使用 warn 级别", () => {
    const request = createRequest();
    const response = createResponse(429);
    const next: NextFunction = vi.fn();

    middleware.use(request, response, next);
    response.__emitFinish();

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("traceId 缺失时应使用 'anonymous'", () => {
    const request = createRequest({
      method: "GET",
      originalUrl: "/api/v1/test",
      // 不设置 traceId
    });
    const response = createResponse(200);
    const next: NextFunction = vi.fn();

    middleware.use(request, response, next);
    response.__emitFinish();

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = infoSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.traceId).toBe("anonymous");
  });

  it("originalUrl 缺失时应回退到 url", () => {
    const request = createRequest({
      method: "GET",
      url: "/api/v1/fallback",
      // 不设置 originalUrl
    } as Partial<Request>);
    // 删除 originalUrl
    delete (request as { originalUrl?: string }).originalUrl;
    const response = createResponse(200);
    const next: NextFunction = vi.fn();

    middleware.use(request, response, next);
    response.__emitFinish();

    const payload = infoSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.path).toBe("/api/v1/fallback");
  });

  it("应在 next() 之前注册 finish 监听器", () => {
    const request = createRequest();
    const response = createResponse(200);
    const next: NextFunction = vi.fn();

    middleware.use(request, response, next);

    // next 应被调用
    expect(next).toHaveBeenCalledTimes(1);
    // response.on('finish') 应被注册
    expect(response.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  it("duration 字段应为非负数", () => {
    const request = createRequest();
    const response = createResponse(200);
    const next: NextFunction = vi.fn();

    middleware.use(request, response, next);
    // 立即触发 finish（duration 应为 0 或正数）
    response.__emitFinish();

    const payload = infoSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(typeof payload.duration).toBe("number");
    expect(payload.duration as number).toBeGreaterThanOrEqual(0);
  });

  it("日志消息格式应为 'METHOD PATH STATUS DURATIONms'", () => {
    const request = createRequest({
      method: "DELETE",
      originalUrl: "/api/v1/projects/p-001",
      traceId: "trace-format",
    });
    const response = createResponse(204);
    const next: NextFunction = vi.fn();

    middleware.use(request, response, next);
    response.__emitFinish();

    const message = infoSpy.mock.calls[0]?.[1] as string;
    expect(message).toMatch(/^DELETE \/api\/v1\/projects\/p-001 204 \d+ms$/);
  });
});
