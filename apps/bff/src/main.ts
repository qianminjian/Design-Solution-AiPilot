import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { logger, PinoLoggerService } from "./infra/logger";

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

  // 全局替换 NestJS Logger 为 pino，使框架内部日志也走结构化 JSON
  app.useLogger(new PinoLoggerService());

  // CORS — 开发环境允许前端跨域
  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  });

  // 全局前缀：所有路由前加 /api
  app.setGlobalPrefix("api");

  // body 解析限制 10mb，支持文件上传场景（设计文件元数据/批量导入等）
  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true, limit: "10mb" }));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.info(
    { service: "bff", event: "server_started", port },
    `BFF listening on http://localhost:${port}`,
  );
}

bootstrap();
