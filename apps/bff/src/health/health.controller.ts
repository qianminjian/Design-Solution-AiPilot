import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import { HealthService, type HealthCheckResult } from "./health.service";

/**
 * 健康检查控制器
 * - GET /api/v1/health：聚合 BFF/Core/AI/PostgreSQL/MinIO 状态
 * - 整体 UP 返回 200；任一依赖 DOWN 返回 503（便于 K8s liveness/readiness 探针与负载均衡摘除）
 * - 不需认证（已纳入 BFF API 路径白名单）
 * - 使用 @Res({ passthrough: true }) 同时保留 DI 与自定义状态码
 */
@Controller("v1/health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(
    @Res({ passthrough: true }) response: Response,
  ): Promise<HealthCheckResult> {
    const result: HealthCheckResult = await this.healthService.checkAll();
    response.status(
      result.status === "UP"
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );
    return result;
  }
}
