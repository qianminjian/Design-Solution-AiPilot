import {
  All,
  Controller,
  Inject,
  Post,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { Method } from "axios";
import { HttpHeader } from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";

/**
 * 规则集代理控制器
 * 转发 /v1/rule-sets/** 到 Core Service（Java）
 *
 * 契约验证策略（V0 透传模式）：
 *  - 规则集 DTO 结构较复杂（含规则引用列表），暂不做严格验证
 *  - 所有请求保持透传，后续根据契约漂移频率决定是否升级验证模式
 */
@Controller("v1/rule-sets")
@UseInterceptors(ProxyInterceptor)
export class RuleSetProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
  ) {}

  /** 创建规则集 */
  @Post()
  async create(@Req() request: Request): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: "POST",
      path: request.originalUrl,
      body: request.body,
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });
  }

  /** 其他路由统一代理（透传） */
  @All("*")
  proxy(@Req() request: Request): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: request.method as Method,
      path: request.originalUrl,
      body: this.extractBody(request),
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });
  }

  private extractBody(request: Request): unknown {
    const method = request.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "DELETE") {
      return undefined;
    }
    return request.body;
  }

  private extractForwardHeaders(
    request: Request,
  ): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};
    const forwardHeaderNames = [
      HttpHeader.AUTHORIZATION,
      HttpHeader.X_TENANT_ID,
      "x-user-id",
      HttpHeader.X_TRACE_ID,
      HttpHeader.IDEMPOTENCY_KEY,
      "content-type",
      HttpHeader.ACCEPT_LANGUAGE,
      HttpHeader.X_TEST_RUN_ID,
    ];

    for (const name of forwardHeaderNames) {
      const value = request.header(name);
      if (value !== undefined && value.length > 0) {
        headers[name] = value;
      }
    }

    if (!headers[HttpHeader.X_TRACE_ID] && request.traceId) {
      headers[HttpHeader.X_TRACE_ID] = request.traceId;
    }

    return headers;
  }

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
