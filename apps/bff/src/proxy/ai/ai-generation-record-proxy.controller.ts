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
import {
  HttpHeader,
  aiGenerationRecordDtoSchema,
} from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * AI 生成记录代理控制器 — 审计追溯
 *
 * 转发 /v1/ai-generation-records/* 到 Core Service（Java），用于：
 * - AI Service 在生成方案后通过 BFF 创建记录
 * - 前端查询 AI 生成记录（按项目、设计选项、traceId 反查）
 *
 * 契约验证（security.md §12 AI 安全红线）：
 *  - POST 创建响应使用严格验证，确保审计记录包含 reviewStatus 字段
 *  - GET 单条查询使用严格验证，确保前端展示的审计记录结构完整
 *  - GET 列表查询保持透传（结构可能为分页响应，由前端自行处理）
 */
@Controller("v1/ai-generation-records")
@UseInterceptors(ProxyInterceptor)
export class AiGenerationRecordProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
  ) {}

  /**
   * 创建 AI 生成记录（审计追溯）
   * 严格验证响应：必须包含 reviewStatus 与 requiresHumanReview 字段
   * 仅在 2xx 成功响应时验证，错误响应（4xx/5xx）直接透传
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
        aiGenerationRecordDtoSchema,
        {
          domain: "ai-generation-record",
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
   * 查询单条 AI 生成记录（按 ID）
   * 严格验证响应：审计记录结构必须完整（含 reviewStatus）
   * 仅在 2xx 成功响应时验证，错误响应（4xx/5xx）直接透传
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
        aiGenerationRecordDtoSchema,
        {
          domain: "ai-generation-record",
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
   * 其他方法（列表查询、按 traceId 反查等）保持透传
   * 列表查询响应为分页结构，由前端自行处理
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
