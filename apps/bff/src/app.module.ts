import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { APP_FILTER } from "@nestjs/core";
import { HealthController } from "./health.controller";
import appConfig from "./config/app.config";
import { TraceIdMiddleware } from "./middleware/trace-id.middleware";
import { LoggingMiddleware } from "./middleware/logging.middleware";
import { HttpExceptionFilter } from "./filters/http-exception.filter";
import { ProxyModule } from "./proxy/proxy.module";

/**
 * 根模块
 * - 注册全局中间件（traceId 传播 + 请求日志）
 * - 注册全局过滤器（异常统一格式）
 * - 注册代理模块（转发到 Core Service）
 * - 健康检查不走代理，仍由 HealthController 处理
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      cache: true,
    }),
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 3,
    }),
    ProxyModule,
  ],
  controllers: [HealthController],
  providers: [
    // 全局异常过滤器：捕获所有异常并统一为 ApiErrorResponse 格式
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * 注册全局中间件
   * - TraceIdMiddleware 必须先执行：写入 traceId 到 request + AsyncLocalStorage
   * - LoggingMiddleware 后执行：依赖 traceId 输出结构化请求日志
   * - 健康检查路由同样启用，便于可观测性
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceIdMiddleware, LoggingMiddleware).forRoutes("*");
  }
}
