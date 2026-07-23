import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { MetricsService } from "./metrics.service";

/**
 * 规范化路由路径（避免高基数 path label）
 * - 将动态段（如 UUID / 数字 ID）替换为占位符
 * - 例如 /api/v1/projects/abc-123-xyz → /api/v1/projects/:id
 * - 防止 /projects/1、/projects/2 产生无限 label 组合
 */
function normalizeRoutePath(req: Request): string {
  const original = req.originalUrl || req.url;
  const pathOnly = original.split("?")[0] ?? original;

  // 简单启发式：把 UUID 形态的段替换为 :id
  return pathOnly
    .replace(/\/[0-9a-fA-F-]{8,}/g, "/:id")
    .replace(/\/\d+/g, "/:id");
}

/**
 * HTTP 指标收集中间件
 * - 记录 bff_http_requests_total 与 bff_http_request_duration_seconds
 * - 通过构造参数显式注入 MetricsService，避免箭头函数回调中的 this 绑定问题
 * - 由 MetricsModule 的 configure 通过 consumer.apply 注册
 *
 * 基数防护（observability.md §3.3）：
 * - path 维度使用路由模板（:id 形式）而非原始 URL
 * - status 维度仅取 1xx/2xx/3xx/4xx/5xx 状态码本身
 */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    // 跳过 metrics 自身，避免抓取时自增
    if (request.originalUrl.startsWith("/api/v1/metrics")) {
      next();
      return;
    }

    // 显式捕获 service 引用，避免回调中 this 指向 ServerResponse
    const metricsService = this.metricsService;
    if (!metricsService) {
      next();
      return;
    }

    const start = process.hrtime.bigint();
    const method = request.method;
    // 提前记录 path（不依赖 route，因 NextFunction 之前无 route 信息）
    const earlyPath = normalizeRoutePath(request);

    response.on("finish", () => {
      try {
        const elapsedNs = process.hrtime.bigint() - start;
        const elapsedSeconds = Number(elapsedNs) / 1e9;
        const status = String(response.statusCode);

        // finish 事件触发时 req.route 已被 Express 设置，使用更精确的模板
        const finalPath =
          request.route?.path && request.baseUrl
            ? `${request.baseUrl}${request.route.path}`
            : earlyPath;

        const labels = { method, path: finalPath, status };

        metricsService.httpRequestsTotal.inc(labels);
        metricsService.httpRequestDurationSeconds.observe(
          labels,
          elapsedSeconds,
        );
      } catch {
        // app 已关闭或 registry 已释放时忽略，避免测试清理阶段未捕获异常
      }
    });

    next();
  }
}
