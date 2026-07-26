import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import {
  INestApplication,
  Controller,
  Get,
  Header,
  Res,
  Inject,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { Response } from "express";
import appConfig from "../../../src/config/app.config";
import { MetricsService } from "../../../src/metrics/metrics.service";

@Controller("v1/metrics")
class TestMetricsController {
  constructor(
    @Inject(MetricsService) private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async getMetrics(@Res({ passthrough: true }) response: Response) {
    const body = await this.metricsService.toText();
    response.setHeader(
      "Content-Type",
      "text/plain; version=0.0.4; charset=utf-8",
    );
    return body;
  }
}

describe("Metrics API 集成测试", () => {
  let app: INestApplication;
  let mockToText: vi.Mock;

  beforeEach(async () => {
    mockToText = vi.fn();
    mockToText.mockResolvedValue(`# HELP bff_http_requests_total BFF 接收到的 HTTP 请求总数
# TYPE bff_http_requests_total counter
bff_http_requests_total{method="GET",path="/api/v1/health",status="200"} 1
# HELP bff_http_request_duration_seconds BFF HTTP 请求耗时（秒）
# TYPE bff_http_request_duration_seconds histogram
bff_http_request_duration_seconds_bucket{method="GET",path="/api/v1/health",status="200",le="0.001"} 1
# HELP bff_proxy_calls_total BFF 代理到下游服务的调用总数
# TYPE bff_proxy_calls_total counter
# HELP bff_proxy_call_duration_seconds BFF 代理到下游服务的调用耗时（秒）
# TYPE bff_proxy_call_duration_seconds histogram
# HELP bff_jwt_active_sessions 当前活跃 JWT 会话数（gauge）
# TYPE bff_jwt_active_sessions gauge
bff_jwt_active_sessions 0
# HELP bff_schema_validation_failures_total BFF schema 验证失败总数（按 domain/operation/mode 聚合）
# TYPE bff_schema_validation_failures_total counter
bff_schema_validation_failures_total{domain="auth",operation="login",mode="soft"} 2
# HELP bff_node_process_uptime_seconds Node 进程运行时长（秒）
# TYPE bff_node_process_uptime_seconds gauge
bff_node_process_uptime_seconds 120.5
`);

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [appConfig],
          cache: true,
        }),
      ],
      controllers: [TestMetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: { toText: mockToText },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    vi.clearAllMocks();
  });

  it("应该在 GET /api/v1/metrics 返回 200 与 Prometheus 文本格式", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/metrics");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(typeof response.text).toBe("string");
    expect(response.text).toContain("# HELP");
    expect(response.text).toContain("# TYPE");
    expect(response.text).toContain("bff_http_requests_total");
    expect(response.text).toContain("bff_http_request_duration_seconds");
    expect(response.text).toContain("bff_proxy_calls_total");
    expect(response.text).toContain("bff_proxy_call_duration_seconds");
    expect(response.text).toContain("bff_jwt_active_sessions");
    expect(response.text).toContain("bff_schema_validation_failures_total");
    expect(response.text).toContain("bff_node_process_uptime_seconds");
  });

  it("应该在发生 HTTP 请求后递增 bff_http_requests_total 指标", async () => {
    mockToText.mockResolvedValueOnce(`# HELP bff_http_requests_total BFF 接收到的 HTTP 请求总数
# TYPE bff_http_requests_total counter
bff_http_requests_total{method="GET",path="/api/v1/projects",status="200"} 1
`);

    const response = await request(app.getHttpServer()).get("/api/v1/metrics");

    expect(response.status).toBe(200);
    expect(response.text).toMatch(
      /bff_http_requests_total\{[^}]*method="GET"[^}]*\}\s+\d+/,
    );
  });
});
