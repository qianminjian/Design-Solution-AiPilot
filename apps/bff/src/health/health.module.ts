import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

/**
 * 健康检查模块
 * - 提供 GET /api/v1/health 端点
 * - 汇总 BFF、Core Service、AI Service、PostgreSQL、MinIO 的可达性
 * - 任一依赖不可用时返回 503，便于 K8s 探针与 LB 摘除
 */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
