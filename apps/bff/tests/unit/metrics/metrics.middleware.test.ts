import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { MetricsMiddleware } from "../../../src/metrics/metrics.middleware";
import { MetricsService } from "../../../src/metrics/metrics.service";

/**
 * MetricsMiddleware 单元测试
 * - 验证 metrics 端点自身跳过（避免抓取时自增）
 * - 验证路径规范化（UUID / 数字 ID → :id）
 * - 验证 httpRequestsTotal 与 httpRequestDurationSeconds 标签聚合
 * - 验证 request.route.path 优先于早期 path
 */
describe("MetricsMiddleware", () => {
  let metricsService: MetricsService;
  let middleware: MetricsMiddleware;

  beforeEach(() => {
    metricsService = new MetricsService();
    middleware = new MetricsMiddleware(metricsService);
  });

  /**
   * 构造 EventEmitter-based Response mock
   * - 支持 on/emit 触发 'finish' 事件
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

  /** 构造 Request mock */
  function createRequest(
    overrides: Partial<Request> & {
      originalUrl?: string;
      url?: string;
      method?: string;
      route?: { path: string };
      baseUrl?: string;
    } = {},
  ): Request {
    return {
      method: "GET",
      originalUrl: "/api/v1/test",
      url: "/api/v1/test",
      ...overrides,
    } as unknown as Request;
  }

  describe("跳过 metrics 端点自身", () => {
    it("应该在 path 以 /api/v1/metrics 开头时跳过指标记录", () => {
      const request = createRequest({
        originalUrl: "/api/v1/metrics",
      });
      const response = createResponse();
      const next: NextFunction = vi.fn();
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);

      expect(next).toHaveBeenCalledTimes(1);
      // 触发 finish 也不应记录
      response.__emitFinish();
      expect(incSpy).not.toHaveBeenCalled();
    });

    it("应该跳过 /api/v1/metrics 的子路径", () => {
      const request = createRequest({
        originalUrl: "/api/v1/metrics/detail",
      });
      const response = createResponse();
      const next: NextFunction = vi.fn();
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      expect(incSpy).not.toHaveBeenCalled();
    });

    it("应该正常记录非 metrics 路径", () => {
      const request = createRequest({
        originalUrl: "/api/v1/projects",
      });
      const response = createResponse();
      const next: NextFunction = vi.fn();
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      expect(incSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("路径规范化", () => {
    it("应该将 UUID 路径段替换为 :id", async () => {
      const request = createRequest({
        originalUrl: "/api/v1/projects/550e8400-e29b-41d4-a716-446655440000",
      });
      const response = createResponse();
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      const labels = incSpy.mock.calls[0]?.[0] as {
        method: string;
        path: string;
        status: string;
      };
      expect(labels.path).toBe("/api/v1/projects/:id");
    });

    it("应该将数字 ID 路径段替换为 :id", () => {
      const request = createRequest({
        originalUrl: "/api/v1/projects/12345",
      });
      const response = createResponse();
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      const labels = incSpy.mock.calls[0]?.[0] as { path: string };
      expect(labels.path).toBe("/api/v1/projects/:id");
    });

    it("应该剥离 query string", () => {
      const request = createRequest({
        originalUrl: "/api/v1/projects?page=1&size=20",
      });
      const response = createResponse();
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      const labels = incSpy.mock.calls[0]?.[0] as { path: string };
      expect(labels.path).toBe("/api/v1/projects");
    });

    it("应该处理 originalUrl 缺失时回退到 url", () => {
      const request = createRequest({
        originalUrl: undefined as unknown as string,
        url: "/api/v1/fallback",
      });
      const response = createResponse();
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      const labels = incSpy.mock.calls[0]?.[0] as { path: string };
      expect(labels.path).toBe("/api/v1/fallback");
    });

    it("应该处理多个 UUID 段", () => {
      const request = createRequest({
        originalUrl:
          "/api/v1/projects/550e8400-e29b-41d4-a716-446655440000/documents/abc-123-xyz",
      });
      const response = createResponse();
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      const labels = incSpy.mock.calls[0]?.[0] as { path: string };
      expect(labels.path).toBe("/api/v1/projects/:id/documents/:id");
    });
  });

  describe("指标记录", () => {
    it("应该在响应 finish 时记录 httpRequestsTotal（含 method/path/status）", () => {
      const request = createRequest({
        method: "GET",
        originalUrl: "/api/v1/projects",
      });
      const response = createResponse(200);
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      expect(incSpy).toHaveBeenCalledTimes(1);
      const labels = incSpy.mock.calls[0]?.[0] as {
        method: string;
        path: string;
        status: string;
      };
      expect(labels.method).toBe("GET");
      expect(labels.path).toBe("/api/v1/projects");
      expect(labels.status).toBe("200");
    });

    it("应该在响应 finish 时记录 httpRequestDurationSeconds", () => {
      const request = createRequest({
        method: "POST",
        originalUrl: "/api/v1/auth/login",
      });
      const response = createResponse(201);
      const observeSpy = vi.spyOn(
        metricsService.httpRequestDurationSeconds,
        "observe",
      );

      middleware.use(request, response, next);
      response.__emitFinish();

      expect(observeSpy).toHaveBeenCalledTimes(1);
      const args = observeSpy.mock.calls[0];
      const labels = args?.[0] as { method: string; status: string };
      const duration = args?.[1] as number;
      expect(labels.method).toBe("POST");
      expect(labels.status).toBe("201");
      expect(typeof duration).toBe("number");
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it("应该在 next() 之前注册 finish 监听器", () => {
      const request = createRequest();
      const response = createResponse();
      const next: NextFunction = vi.fn();

      middleware.use(request, response, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(response.on).toHaveBeenCalledWith("finish", expect.any(Function));
    });

    it("5xx 状态码也应被记录", () => {
      const request = createRequest({
        originalUrl: "/api/v1/error",
      });
      const response = createResponse(500);
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      const labels = incSpy.mock.calls[0]?.[0] as { status: string };
      expect(labels.status).toBe("500");
    });

    it("404 状态码也应被记录", () => {
      const request = createRequest({
        originalUrl: "/api/v1/not-found",
      });
      const response = createResponse(404);
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      const labels = incSpy.mock.calls[0]?.[0] as { status: string };
      expect(labels.status).toBe("404");
    });
  });

  describe("route.path 优先于早期 path", () => {
    it("应该优先使用 request.route.path + baseUrl 作为路径模板", () => {
      const request = createRequest({
        originalUrl: "/api/v1/projects/123",
        route: { path: "/:id" },
        baseUrl: "/api/v1/projects",
      });
      const response = createResponse();
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      const labels = incSpy.mock.calls[0]?.[0] as { path: string };
      expect(labels.path).toBe("/api/v1/projects/:id");
    });

    it("route.path 缺失时应回退到早期规范化 path", () => {
      const request = createRequest({
        originalUrl: "/api/v1/projects/123",
        // 不设置 route
      });
      const response = createResponse();
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      const labels = incSpy.mock.calls[0]?.[0] as { path: string };
      expect(labels.path).toBe("/api/v1/projects/:id");
    });

    it("baseUrl 缺失时应回退到早期规范化 path", () => {
      const request = createRequest({
        originalUrl: "/api/v1/projects/123",
        route: { path: "/:id" },
        // 不设置 baseUrl
      });
      const response = createResponse();
      const incSpy = vi.spyOn(metricsService.httpRequestsTotal, "inc");

      middleware.use(request, response, next);
      response.__emitFinish();

      const labels = incSpy.mock.calls[0]?.[0] as { path: string };
      expect(labels.path).toBe("/api/v1/projects/:id");
    });
  });

  describe("异常容错", () => {
    it("metricsService 为 null 时应直接调用 next 不抛错", () => {
      const middlewareWithoutService = new MetricsMiddleware(
        null as unknown as MetricsService,
      );
      const request = createRequest();
      const response = createResponse();
      const next: NextFunction = vi.fn();

      // 不应抛错
      expect(() =>
        middlewareWithoutService.use(request, response, next),
      ).not.toThrow();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("finish 回调中 metricsService.inc 抛错时不应影响请求", () => {
      const request = createRequest();
      const response = createResponse();
      const next: NextFunction = vi.fn();
      // inc 抛错
      vi.spyOn(metricsService.httpRequestsTotal, "inc").mockImplementation(
        () => {
          throw new Error("registry closed");
        },
      );

      middleware.use(request, response, next);
      // finish 回调中的异常应被捕获
      expect(() => response.__emitFinish()).not.toThrow();
    });
  });
});

/** 占位 next 函数 */
function next(): void {
  // 测试中通过 vi.fn() 注入
}
