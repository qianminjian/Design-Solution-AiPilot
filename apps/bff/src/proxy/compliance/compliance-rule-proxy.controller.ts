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
import {
  HttpHeader,
  complianceRuleDtoSchema,
  ruleRevisionDtoSchema,
  idsImportResponseSchema,
} from "@design-platform/shared";
import type { ZodType } from "zod";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * 合规规则代理控制器
 * 转发 /v1/compliance-rules/** 到 Core Service（Java）
 *
 * 契约验证策略（V0 严格+软验证混合）：
 *  - POST / (创建)、POST /import-ids (导入)：严格验证
 *  - GET /:id、POST /:id/revisions、POST /revisions/:id/activate：软验证
 *  - GET / (列表)、PATCH /:id、DELETE /:id：透传
 */
@Controller("v1/compliance-rules")
@UseInterceptors(ProxyInterceptor)
export class ComplianceRuleProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
  ) {}

  /** 创建合规规则（严格验证） */
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
      this.schemaValidator.validateStrict(
        businessData,
        complianceRuleDtoSchema as ZodType<unknown>,
        {
          domain: "compliance-rule",
          operation: "create",
          traceId: request.traceId,
          downstreamService: "core-service",
        },
      );
    }

    return result;
  }

  /** IDS 导入（严格验证） */
  @Post("import-ids")
  async importIds(@Req() request: Request): Promise<ProxyResult> {
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
        idsImportResponseSchema as ZodType<unknown>,
        {
          domain: "compliance-rule",
          operation: "importIds",
          traceId: request.traceId,
          downstreamService: "core-service",
        },
      );
    }

    return result;
  }

  /** 其他路由统一代理（含软验证） */
  @All("*")
  async proxy(@Req() request: Request): Promise<ProxyResult> {
    const result = await this.proxyService.forward({
      method: request.method as Method,
      path: request.originalUrl,
      body: this.extractBody(request),
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });

    if (result.status >= 200 && result.status < 300) {
      this.validateSoftByPath(result, request);
    }

    return result;
  }

  /** 根据 path 模式匹配对应的 schema 做软验证 */
  private validateSoftByPath(result: ProxyResult, request: Request): void {
    const match = this.matchSchema(request.method, request.originalUrl);
    if (!match) return;

    const businessData = this.schemaValidator.extractBusinessData(result);
    if (Array.isArray(businessData)) return;

    this.schemaValidator.validateSoft(businessData, match.schema, {
      domain: "compliance-rule",
      operation: match.operation,
      traceId: request.traceId,
      downstreamService: "core-service",
    });
  }

  /** 匹配 compliance-rule 域 path 与对应 schema */
  private matchSchema(
    method: string,
    path: string,
  ): { schema: ZodType<unknown>; operation: string } | null {
    const upperMethod = method.toUpperCase();
    const pathOnly = path.split("?")[0] ?? path;

    // GET /api/v1/compliance-rules/:id (单个详情)
    if (
      upperMethod === "GET" &&
      /\/api\/v1\/compliance-rules\/[^/]+$/.test(pathOnly)
    ) {
      return {
        schema: complianceRuleDtoSchema as ZodType<unknown>,
        operation: "getById",
      };
    }

    // POST /api/v1/compliance-rules/:id/revisions (创建修订)
    if (
      upperMethod === "POST" &&
      /\/api\/v1\/compliance-rules\/[^/]+\/revisions$/.test(pathOnly)
    ) {
      return {
        schema: ruleRevisionDtoSchema as ZodType<unknown>,
        operation: "createRevision",
      };
    }

    // POST /api/v1/compliance-rules/revisions/:revisionId/activate
    if (
      upperMethod === "POST" &&
      /\/api\/v1\/compliance-rules\/revisions\/[^/]+\/activate$/.test(pathOnly)
    ) {
      return {
        schema: ruleRevisionDtoSchema as ZodType<unknown>,
        operation: "activateRevision",
      };
    }

    // GET /api/v1/compliance-rules/revisions/:revisionId (修订详情)
    if (
      upperMethod === "GET" &&
      /\/api\/v1\/compliance-rules\/revisions\/[^/]+$/.test(pathOnly)
    ) {
      return {
        schema: ruleRevisionDtoSchema as ZodType<unknown>,
        operation: "getRevision",
      };
    }

    return null;
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
