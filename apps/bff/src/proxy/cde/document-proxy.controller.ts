import {
  All,
  Controller,
  Delete,
  Get,
  Inject,
  Patch,
  Post,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { Method } from "axios";
import {
  HttpHeader,
  documentDtoSchema,
  checkoutDtoSchema,
} from "@design-platform/shared";
import type { ZodType } from "zod";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * CDE 文档代理控制器
 * 转发文档 CRUD 与检入检出操作到 Core Service（Java）
 *
 * 端点映射（契约源：@design/D07-CDE领域-版本.md + cde.contract.ts）：
 *  - POST   /v1/projects/:projectId/documents  创建文档（严格验证）
 *  - GET    /v1/projects/:projectId/documents  文档列表（透传）
 *  - GET    /v1/documents/:id                  文档详情（软验证）
 *  - PATCH  /v1/documents/:id                  更新文档（透传）
 *  - DELETE /v1/documents/:id                  删除文档（透传）
 *  - POST   /v1/documents/:id/checkout          检出（严格验证）
 *  - POST   /v1/documents/:id/checkin           检入（透传）
 *
 * 安全：path 字段为 PII L5，日志脱敏由 Core Service 端实现
 */
@Controller("v1")
@UseInterceptors(ProxyInterceptor)
export class CdeDocumentProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
  ) {}

  /** 在项目下创建文档（严格验证） */
  @Post("projects/:projectId/documents")
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
      this.schemaValidator.validateStrict(
        businessData,
        documentDtoSchema as ZodType<unknown>,
        {
          domain: "cde-document",
          operation: "create",
          traceId: request.traceId,
          downstreamService: "core-service",
        },
      );
    }

    return result;
  }

  /** 项目下文档列表（透传） */
  @Get("projects/:projectId/documents")
  listByProject(@Req() request: Request): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: "GET",
      path: request.originalUrl,
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });
  }

  /** 文档详情（软验证） */
  @Get("documents/:id")
  async getById(@Req() request: Request): Promise<ProxyResult> {
    const result = await this.proxyService.forward({
      method: "GET",
      path: request.originalUrl,
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });

    if (result.status >= 200 && result.status < 300) {
      const businessData = this.schemaValidator.extractBusinessData(result);
      if (businessData && !Array.isArray(businessData)) {
        this.schemaValidator.validateSoft(
          businessData,
          documentDtoSchema as ZodType<unknown>,
          {
            domain: "cde-document",
            operation: "getById",
            traceId: request.traceId,
            downstreamService: "core-service",
          },
        );
      }
    }

    return result;
  }

  /** 更新文档元数据（透传） */
  @Patch("documents/:id")
  update(@Req() request: Request): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: "PATCH",
      path: request.originalUrl,
      body: request.body,
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });
  }

  /** 删除文档（透传） */
  @Delete("documents/:id")
  delete(@Req() request: Request): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: "DELETE",
      path: request.originalUrl,
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });
  }

  /** 检出文档（严格验证） */
  @Post("documents/:id/checkout")
  async checkout(@Req() request: Request): Promise<ProxyResult> {
    const result = await this.proxyService.forward({
      method: "POST",
      path: request.originalUrl,
      body: request.body,
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });

    if (result.status >= 200 && result.status < 300) {
      const businessData = this.schemaValidator.extractBusinessData(result);
      this.schemaValidator.validateStrict(
        businessData,
        checkoutDtoSchema as ZodType<unknown>,
        {
          domain: "cde-document",
          operation: "checkout",
          traceId: request.traceId,
          downstreamService: "core-service",
        },
      );
    }

    return result;
  }

  /** 检入文档（透传） */
  @Post("documents/:id/checkin")
  checkin(@Req() request: Request): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: "POST",
      path: request.originalUrl,
      body: request.body,
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });
  }

  /** 未知文档路由兜底（透传） */
  @All("documents/*")
  proxy(@Req() request: Request): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: request.method as Method,
      path: request.originalUrl,
      body: this.extractBody(request),
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });
  }

  private extractForwardHeaders(
    request: Request,
  ): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};
    const forwardHeaderNames = [
      HttpHeader.AUTHORIZATION,
      HttpHeader.X_TENANT_ID,
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
    query: Record<string, unknown>,
  ): Record<string, string | string[]> | undefined {
    if (!query || Object.keys(query).length === 0) return undefined;
    const normalized: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      normalized[key] = String(value);
    }
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  private extractBody(request: Request): Record<string, unknown> | undefined {
    if (!request.body || Object.keys(request.body).length === 0)
      return undefined;
    return request.body;
  }
}
