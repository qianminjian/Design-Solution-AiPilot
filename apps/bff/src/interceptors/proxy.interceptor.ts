import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, catchError, map, tap, throwError } from "rxjs";
import { Request, Response } from "express";
import { AxiosError } from "axios";
import { HttpHeader } from "@design-platform/shared";

/**
 * 代理服务返回结果
 * - status：下游 HTTP 状态码
 * - data：下游响应体
 * - headers：下游响应头（仅透传业务相关）
 */
export interface ProxyResult {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

/**
 * 判断是否为 ProxyResult
 */
function isProxyResult(value: unknown): value is ProxyResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    "data" in value &&
    "headers" in value
  );
}

/**
 * 不应透传给前端的 hop-by-hop 头
 * 参考 RFC 7230 §6.1
 */
const HOP_BY_HOP_HEADERS = new Set<string>([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "content-encoding",
  "host",
]);

/**
 * 代理拦截器
 * - 将下游 Core Service 返回的 ApiResponse 原样透传给前端
 * - 保留下游状态码与 ETag/Content-Type 等业务相关头
 * - 下游错误（非 2xx）会被 ProxyService 转为 AxiosError 抛出，
 *   交由全局 HttpExceptionFilter 统一处理
 */
@Injectable()
export class ProxyInterceptor<T = unknown> implements NestInterceptor<
  T,
  unknown
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const traceId =
      request.traceId ?? request.header(HttpHeader.X_TRACE_ID) ?? "unknown";

    return next.handle().pipe(
      tap((result: unknown) => {
        if (!isProxyResult(result)) {
          return;
        }
        // 1. 设置下游状态码
        response.status(result.status);
        // 2. 透传业务相关响应头（ETag、Content-Type、Last-Modified 等）
        for (const [key, value] of Object.entries(result.headers)) {
          if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
          if (typeof value === "string" && value.length > 0) {
            response.setHeader(key, value);
          }
        }
      }),
      map((result: unknown) => (isProxyResult(result) ? result.data : result)),
      catchError((error: unknown) =>
        throwError(() => this.wrapError(error, traceId)),
      ),
    );
  }

  /**
   * 将下游错误包装后抛出
   * 全局 HttpExceptionFilter 会进一步处理
   */
  private wrapError(error: unknown, traceId: string): unknown {
    // AxiosError 直接透传，由全局过滤器提取下游响应
    if (this.isAxiosError(error)) {
      return error as AxiosError;
    }
    // 其他错误保留 traceId 上下文（错误信息中包含 traceId 便于排查）
    if (error instanceof Error) {
      error.message = `[traceId=${traceId}] ${error.message}`;
    }
    return error;
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return (
      typeof error === "object" &&
      error !== null &&
      "isAxiosError" in error &&
      (error as { isAxiosError: unknown }).isAxiosError === true
    );
  }
}
