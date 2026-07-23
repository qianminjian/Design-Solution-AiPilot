import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { Level } from "pino";
import { logger } from "../infra/logger";

/**
 * 请求日志中间件
 * - 记录每个 HTTP 请求的方法、路径、状态码、耗时、traceId
 * - 字段对齐 .trae/rules/observability.md §1.2、§3.1（RED 指标）
 * - 使用 pino 直接输出，traceId 通过 logger mixin 自动注入（AsyncLocalStorage）
 *
 * 注意：必须在 TraceIdMiddleware 之后注册，确保 traceId 已写入 request context
 */
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const startTime = Date.now();
    const method = request.method;
    // originalUrl 含 query string，便于排查带参请求
    const path = request.originalUrl ?? request.url;

    // 响应结束时记录日志（不论成功/失败）
    response.on("finish", () => {
      const duration = Date.now() - startTime;
      const statusCode = response.statusCode;
      const traceId = request.traceId ?? "anonymous";

      // 4xx/5xx 用 warn 以上级别，便于按级别过滤
      const level: Level = this.resolveLevel(statusCode);
      const logFn = logger[level].bind(logger);
      logFn(
        {
          method,
          path,
          status: statusCode,
          duration,
          traceId,
        },
        `${method} ${path} ${statusCode} ${duration}ms`,
      );
    });

    next();
  }

  /**
   * 根据状态码选择日志级别
   * - 5xx：error（服务端错误）
   * - 4xx：warn（客户端错误）
   * - 其他：info
   */
  private resolveLevel(statusCode: number): Level {
    if (statusCode >= 500) return "error";
    if (statusCode >= 400) return "warn";
    return "info";
  }
}
