import { Controller, Get, Header, Res } from "@nestjs/common";
import type { Response } from "express";
import { MetricsService } from "./metrics.service";

/**
 * 指标控制器
 * - 暴露 GET /api/v1/metrics
 * - 不需认证（observability.md §3.4 指标端点惯例）
 * - Content-Type 使用 Prometheus 文本格式（text/plain; version=0.0.4）
 * - 使用 @Res({ passthrough: true }) 同时保留 DI 与自定义响应头
 */
@Controller("v1/metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async getMetrics(
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const body = await this.metricsService.toText();
    response.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    return body;
  }
}
