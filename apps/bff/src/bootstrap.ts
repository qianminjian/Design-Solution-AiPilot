import { NestExpressApplication } from "@nestjs/platform-express";
import { json, urlencoded } from "express";
import { PinoLoggerService } from "./infra/logger";

/**
 * BFF body 解析上限：10mb（设计文件元数据 / 批量导入等场景）
 */
const BODY_LIMIT = "10mb";

/**
 * 默认 CORS 源（与 config/app.config.ts 一致）
 */
const DEFAULT_CORS_ORIGIN = "http://localhost:3000";

/**
 * 全局 API 前缀
 */
const GLOBAL_PREFIX = "api";

/**
 * 配置 NestExpressApplication 实例
 *
 * 抽离自 main.ts，使下列配置可在集成测试中复用，避免启动真实端口才能验证：
 * - 全局替换 NestJS Logger 为 pino（结构化 JSON）
 * - 启用 CORS（开发环境允许前端跨域，默认源来自 CORS_ORIGIN 环境变量）
 * - 设置全局前缀 /api
 * - 注册 body 解析（json / urlencoded，限制 10mb）
 *
 * 不包括 listen 调用，便于测试用 supertest 验证配置效果。
 *
 * @param app NestExpressApplication 实例
 */
export function configureApp(app: NestExpressApplication): void {
  // 全局替换 NestJS Logger 为 pino，使框架内部日志也走结构化 JSON
  app.useLogger(new PinoLoggerService());

  // CORS — 开发环境允许前端跨域
  app.enableCors({
    origin: process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGIN,
    credentials: true,
  });

  // 全局前缀：所有路由前加 /api
  app.setGlobalPrefix(GLOBAL_PREFIX);

  // body 解析限制 10mb，支持文件上传场景（设计文件元数据/批量导入等）
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));
}
