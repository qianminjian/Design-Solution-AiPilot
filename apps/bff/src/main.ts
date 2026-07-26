import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { logger } from "./infra/logger";
import { configureApp } from "./bootstrap";

/**
 * BFF 启动入口
 * - 全局前缀 /api
 * - body 解析限制 10mb（支持文件上传场景）
 * - 全局异常过滤器已通过 APP_FILTER 在 AppModule 中注册
 * - 日志使用 pino（结构化 JSON），通过 PinoLoggerService 适配 NestJS Logger
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // 关闭 NestJS 默认 Logger，由 PinoLoggerService 接管
    logger: false,
  });

  // 应用配置（CORS / 全局前缀 / body 解析 / pino logger）
  configureApp(app);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.info(
    { service: "bff", event: "server_started", port },
    `BFF listening on http://localhost:${port}`,
  );
}

bootstrap();
