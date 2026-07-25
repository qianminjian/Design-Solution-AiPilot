import {
  All,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { Method } from "axios";
import { HttpHeader, verificationItemDtoSchema } from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * 验证项代理控制器
 * 转发 /v1/verification-items/* 到 Core Service
 *
 * 契约验证策略：
 *  - POST / (create)：严格验证响应，确保含 riskLevel 字段（AI 安全红线）
 *  - GET /:id (详情)：严格验证响应，确保前端展示的验证项结构完整
 *  - GET / (列表)、PATCH、DELETE 等：保持透传，列表响应格式多样由前端处理
 */
@Controller("v1/verification-items")
@UseInterceptors(ProxyInterceptor)
export class VerificationItemProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
  ) {}

  /**
   * 创建验证项
   * 严格验证响应：必须含 riskLevel 与 status 字段
   * 仅在 2xx 成功响应时验证，错误响应直接透传
   * 兼容 ApiResponse<T> 包装格式（Java Core Service）与裸对象
   */
  @Post()
  async create(@Req() request: Request): Promise<ProxyResult> {
    const result = await this.proxyService.forward({
      method: "POST",
      path: request.originalUrl,
      body: request.body,
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });

    if (result.status >= 200 && result.status < 300) {
      const businessData = this.schemaValidator.extractBusinessData(result);
      const validatedData = this.schemaValidator.validateStrict(
        businessData,
        verificationItemDtoSchema,
        {
          domain: "verification-items",
          operation: "create",
          traceId: request.traceId,
          downstreamService: "core-service",
        },
      );
      this.schemaValidator.writeBackBusinessData(result, validatedData);
    }

    return result;
  }

  /**
   * 查询单条验证项（按 ID）
   * 严格验证响应：验证项结构必须完整（含 riskLevel）
   * 仅在 2xx 成功响应时验证，错误响应直接透传
   */
  @Get(":id")
  async getById(
    @Req() request: Request,
    @Param("id") _id: string,
  ): Promise<ProxyResult> {
    const result = await this.proxyService.forward({
      method: "GET",
      path: request.originalUrl,
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });

    if (result.status >= 200 && result.status < 300) {
      const businessData = this.schemaValidator.extractBusinessData(result);
      const validatedData = this.schemaValidator.validateStrict(
        businessData,
        verificationItemDtoSchema,
        {
          domain: "verification-items",
          operation: "getById",
          traceId: request.traceId,
          downstreamService: "core-service",
        },
      );
      this.schemaValidator.writeBackBusinessData(result, validatedData);
    }

    return result;
  }

  /**
   * 其他方法（列表查询、PATCH 更新、DELETE 等）保持透传
   * 列表查询响应为分页结构，PATCH/DELETE 由前端处理
   */
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
