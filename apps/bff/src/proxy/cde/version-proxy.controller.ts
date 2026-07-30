import {
  All,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { Method } from "axios";
import { HttpHeader, documentVersionDtoSchema } from "@design-platform/shared";
import type { ZodType } from "zod";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * CDE 版本代理控制器
 * 转发文档版本管理与上传操作到 Core Service（Java）
 *
 * 端点映射（契约源：@design/D07-CDE领域-版本.md + cde.contract.ts）：
 *  - GET  /v1/documents/:documentId/versions            版本列表（透传）
 *  - POST /v1/documents/:documentId/versions            上传新版本（严格验证）
 *  - GET  /v1/documents/:documentId/versions/:versionId  版本详情（软验证）
 *
 * 上传说明：二进制文件上传由前端通过 MinIO 预签名 URL 直传，
 * BFF 仅代理元数据请求（storageKey/checksum/mimeType 等）
 */
@Controller("v1/documents/:documentId/versions")
@UseInterceptors(ProxyInterceptor)
export class CdeVersionProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
  ) {}

  /** 版本列表（透传） */
  @Get()
  list(@Req() request: Request): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: "GET",
      path: request.originalUrl,
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });
  }

  /** 上传新版本（严格验证） */
  @Post()
  async upload(@Req() request: Request): Promise<ProxyResult> {
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
        documentVersionDtoSchema as ZodType<unknown>,
        {
          domain: "cde-version",
          operation: "upload",
          traceId: request.traceId,
          downstreamService: "core-service",
        },
      );
    }

    return result;
  }

  /** 版本详情（软验证） */
  @Get(":versionId")
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
          documentVersionDtoSchema as ZodType<unknown>,
          {
            domain: "cde-version",
            operation: "getById",
            traceId: request.traceId,
            downstreamService: "core-service",
          },
        );
      }
    }

    return result;
  }

  /** 未知版本路由兜底（透传） */
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
