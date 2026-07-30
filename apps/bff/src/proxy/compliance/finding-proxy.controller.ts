import {
  All,
  Controller,
  Inject,
  Get,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { Method } from "axios";
import { HttpHeader, complianceFindingSchema } from "@design-platform/shared";
import type { ZodType } from "zod";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * 合规发现项代理控制器
 * 转发 /v1/compliance-findings/** 到 Core Service（Java）
 *
 * 契约验证策略（V0 软验证模式）：
 *  - GET /:id → 单个发现详情，软验证 complianceFindingSchema
 *  - GET / → 列表（可按 severity/status/assignedTo 筛选），保持透传
 *  - PATCH /:id → 更新发现，保持透传
 *
 * 注意：shared 包 complianceFindingSchema 与 Core FindingDto 结构可能有差异，
 * 采用软验证模式（仅观察契约漂移，不阻断）。
 */
@Controller("v1/compliance-findings")
@UseInterceptors(ProxyInterceptor)
export class FindingProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
  ) {}

  /** 查询单个发现详情（软验证） */
  @Get(":id")
  async getById(@Req() request: Request): Promise<ProxyResult> {
    const result = await this.proxyService.forward({
      method: "GET",
      path: request.originalUrl,
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });

    if (result.status >= 200 && result.status < 300) {
      const businessData = this.schemaValidator.extractBusinessData(result);
      if (!Array.isArray(businessData)) {
        this.schemaValidator.validateSoft(
          businessData,
          complianceFindingSchema as ZodType<unknown>,
          {
            domain: "compliance-finding",
            operation: "getById",
            traceId: request.traceId,
            downstreamService: "core-service",
          },
        );
      }
    }

    return result;
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
