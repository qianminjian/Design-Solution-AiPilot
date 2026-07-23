import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { MetricsMiddleware } from "./metrics.middleware";

/**
 * 指标模块
 * - 暴露 Prometheus 指标端点 GET /api/v1/metrics
 * - 通过 MetricsMiddleware 自动收集 HTTP 请求级指标
 * - 通过 MetricsService 注入业务模块（proxy 调用、活跃 JWT 会话等）
 */
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsMiddleware],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  /**
   * 注册 HTTP 指标收集中间件（全局生效）
   * - MetricsMiddleware 内部对 /api/v1/metrics 自身做短路，避免抓取放大
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MetricsMiddleware).forRoutes("*");
  }
}
