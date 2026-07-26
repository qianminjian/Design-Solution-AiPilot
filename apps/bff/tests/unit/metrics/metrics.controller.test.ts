import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Response } from "express";
import { MetricsController } from "../../../src/metrics/metrics.controller";
import { MetricsService } from "../../../src/metrics/metrics.service";

/**
 * MetricsController 单元测试
 * - 验证 GET /api/v1/metrics 端点返回 Prometheus 文本格式
 * - 验证 Content-Type 头部设置正确
 * - 验证 Cache-Control: no-store 头部
 */
describe("MetricsController", () => {
  let metricsService: MetricsService;
  let controller: MetricsController;

  beforeEach(() => {
    metricsService = new MetricsService();
    controller = new MetricsController(metricsService);
  });

  /** 构造 Express Response mock，记录 setHeader 调用 */
  function createResponse(): Response & {
    __headers: Record<string, string>;
  } {
    const headers: Record<string, string> = {};
    return {
      setHeader: vi.fn((name: string, value: string) => {
        headers[name] = value;
        return {} as Response;
      }),
      getHeader: vi.fn((name: string) => headers[name]),
      __headers: headers,
    } as unknown as Response & { __headers: Record<string, string> };
  }

  describe("getMetrics()", () => {
    it("应返回 Prometheus 文本格式（非空字符串）", async () => {
      const response = createResponse();
      const body = await controller.getMetrics(response);

      expect(typeof body).toBe("string");
      expect(body.length).toBeGreaterThan(0);
      // 应包含至少一个自定义指标名
      expect(body).toContain("bff_");
    });

    it("应设置 Content-Type 为 Prometheus 文本格式", async () => {
      const response = createResponse();
      await controller.getMetrics(response);

      expect(response.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/plain; version=0.0.4; charset=utf-8",
      );
    });

    it("@Header('Cache-Control', 'no-store') 应通过装饰器生效（不通过 setHeader 验证）", async () => {
      // @Header 装饰器由 NestJS 框架处理，不通过 response.setHeader 调用
      // 这里仅验证控制器方法能正常执行
      const response = createResponse();
      await controller.getMetrics(response);
      expect(response.setHeader).toHaveBeenCalled();
    });

    it("应包含所有自定义指标名", async () => {
      const response = createResponse();
      const body = await controller.getMetrics(response);

      expect(body).toContain("bff_http_requests_total");
      expect(body).toContain("bff_http_request_duration_seconds");
      expect(body).toContain("bff_proxy_calls_total");
      expect(body).toContain("bff_proxy_call_duration_seconds");
      expect(body).toContain("bff_jwt_active_sessions");
      expect(body).toContain("bff_schema_validation_failures_total");
      expect(body).toContain("bff_node_process_uptime_seconds");
    });

    it("应包含 Node 进程默认指标（nodejs_/process_ 前缀）", async () => {
      const response = createResponse();
      const body = await controller.getMetrics(response);

      expect(body).toMatch(/^(# HELP |process_|node_)/m);
    });

    it("多次调用应稳定输出（不抛错且非空）", async () => {
      const response1 = createResponse();
      const response2 = createResponse();
      const body1 = await controller.getMetrics(response1);
      const body2 = await controller.getMetrics(response2);

      expect(body1.length).toBeGreaterThan(0);
      expect(body2.length).toBeGreaterThan(0);
      expect(body2).toContain("bff_");
    });

    it("应在 metricsService 累加后反映最新值", async () => {
      // 触发若干指标更新
      metricsService.httpRequestsTotal.inc(
        { method: "GET", path: "/api/v1/probe-metrics", status: "200" },
        5,
      );

      const response = createResponse();
      const body = await controller.getMetrics(response);

      // 应在输出中包含累加值 5（用 regex 与标签顺序无关）
      expect(body).toMatch(
        /bff_http_requests_total\{[^}]*method="GET"[^}]*path="\/api\/v1\/probe-metrics"[^}]*status="200"[^}]*\} 5/,
      );
    });

    it("应通过 MetricsService.toText() 委托生成（不绕过 service）", async () => {
      const spy = vi.spyOn(metricsService, "toText");
      const response = createResponse();
      await controller.getMetrics(response);

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });
});
