import { All, Controller, Inject, Req, UseInterceptors } from "@nestjs/common";
import { Request } from "express";
import { Method } from "axios";
import { HttpHeader } from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../interceptors/proxy.interceptor";
import { ProxyService } from "./proxy.service";

/**
 * 代理控制器
 * - 匹配所有 /api/v1 开头、非 auth 域的请求
 * - 通过 @All + 通配符路由透传给 Core Service
 * - 由 ProxyInterceptor 处理响应（保留下游 status / 透传 header）
 *
 * 注意：main.ts 设置了全局前缀 "api"，所以 @Controller("v1")
 * 实际匹配 /api/v1/** 路径，与契约 @design/D35-API-事件契约.md 一致
 */
@Controller("v1")
@UseInterceptors(ProxyInterceptor)
export class ProxyController {
  constructor(@Inject(ProxyService) private readonly proxyService: ProxyService) {}

  /**
   * 通配符匹配 /api/v1 下所有非 auth 路径
   * auth 路径由 AuthProxyController 先匹配处理
   */
  @All("*splat")
  proxy(@Req() request: Request): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: request.method as Method,
      // originalUrl 含完整路径（含 query），直接拼接 coreServiceUrl
      path: request.originalUrl,
      body: this.extractBody(request),
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });
  }

  /**
   * 提取请求体（GET/HEAD 无 body）
   */
  private extractBody(request: Request): unknown {
    const method = request.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "DELETE") {
      return undefined;
    }
    return request.body;
  }

  /**
   * 提取需要转发给 Core Service 的请求头
   * - Authorization：身份认证
   * - x-tenant-id：多租户路由
   * - x-trace-id：链路追踪
   * - Idempotency-Key：幂等键（D35.8）
   * - If-Match：乐观并发控制
   * - Content-Type：内容类型
   * - Accept-Language：本地化
   */
  private extractForwardHeaders(
    request: Request,
  ): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};
    const forwardHeaderNames = [
      HttpHeader.AUTHORIZATION,
      HttpHeader.X_TENANT_ID,
      HttpHeader.X_TRACE_ID,
      HttpHeader.IDEMPOTENCY_KEY,
      HttpHeader.IF_MATCH,
      "content-type",
      HttpHeader.ACCEPT_LANGUAGE,
    ];

    for (const name of forwardHeaderNames) {
      const value = request.header(name);
      if (value !== undefined && value.length > 0) {
        headers[name] = value;
      }
    }

    // 确保 traceId 一定存在（中间件已写入 request.traceId）
    if (!headers[HttpHeader.X_TRACE_ID] && request.traceId) {
      headers[HttpHeader.X_TRACE_ID] = request.traceId;
    }

    return headers;
  }

  /**
   * 将 Express 的 query 参数归一化为 Record<string, string | string[]>
   */
  private normalizeQuery(
    query: Request["query"],
  ): Record<string, string | string[]> {
    const result: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(query ?? {})) {
      if (typeof value === "string") {
        result[key] = value;
      } else if (Array.isArray(value)) {
        result[key] = value.filter(
          (item): item is string => typeof item === "string",
        );
      }
    }
    return result;
  }
}
