import { All, Controller, Inject, Req, UseInterceptors } from "@nestjs/common";
import { Request } from "express";
import { Method } from "axios";
import {
  HttpHeader,
  gateDecisionDtoSchema,
  projectBaselineDtoSchema,
  stageInstanceDtoSchema,
} from "@design-platform/shared";
import type { ZodType } from "zod";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * 工作流代理控制器
 * 转发 /api/v1/workflow/** 到 Java 核心服务
 * 涵盖阶段实例列表/流转、门控决策列表/决策，基线列表/详情/冻结
 *
 * 契约验证策略（V0 软验证模式，仅观察契约漂移，不阻断）：
 *  - POST /stages/:id:transition → stageInstanceDtoSchema
 *  - POST /gates/:id:decide → gateDecisionDtoSchema
 *  - POST /baselines/:id:freeze → projectBaselineDtoSchema
 *  - GET /baselines/:id → projectBaselineDtoSchema
 *  - 其他路径：保持透传
 *
 * 软验证的理由：workflow 域路径模式较多，下游 Core Service 实现尚未完全稳定，
 * 先观察契约漂移频率，再决定是否升级为严格模式（参考 schema-validator.service.ts 设计原则）
 */
@Controller("v1/workflow")
@UseInterceptors(ProxyInterceptor)
export class WorkflowProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
  ) {}

  @All("*")
  async proxy(@Req() request: Request): Promise<ProxyResult> {
    const result = await this.proxyService.forward({
      method: request.method as Method,
      path: request.originalUrl,
      body: this.extractBody(request),
      headers: this.extractForwardHeaders(request),
      query: this.normalizeQuery(request.query),
    });

    // 仅对 2xx 响应做软验证，错误响应直接透传
    if (result.status >= 200 && result.status < 300) {
      this.validateSoftByPath(result, request);
    }

    return result;
  }

  /**
   * 根据 path 模式匹配对应的 schema 做软验证
   * 软验证不阻断响应，仅记录契约漂移告警日志
   */
  private validateSoftByPath(result: ProxyResult, request: Request): void {
    const match = this.matchWorkflowSchema(request.method, request.originalUrl);
    if (!match) {
      return;
    }

    const businessData = this.schemaValidator.extractBusinessData(result);
    // 列表响应是数组，跳过单实体 schema 验证
    if (Array.isArray(businessData)) {
      return;
    }

    const validationResult = this.schemaValidator.validateSoft(
      businessData,
      match.schema,
      {
        domain: "workflow",
        operation: match.operation,
        traceId: request.traceId,
        downstreamService: "core-service",
      },
    );

    if (validationResult.success) {
      this.schemaValidator.writeBackBusinessData(result, validationResult.data);
    }
    // 软验证失败：保持原数据透传，仅记录日志（已在 validateSoft 内部记录）
  }

  /**
   * 匹配 workflow 域 path 与对应 schema
   * 返回 null 表示该路径不做验证
   */
  private matchWorkflowSchema(
    method: string,
    path: string,
  ): { schema: ZodType<unknown>; operation: string } | null {
    const upperMethod = method.toUpperCase();
    // 移除 query string
    const pathOnly = path.split("?")[0] ?? path;

    // POST /api/v1/workflow/stages/:id:transition
    if (
      upperMethod === "POST" &&
      /\/api\/v1\/workflow\/stages\/[^/]+:transition$/.test(pathOnly)
    ) {
      return {
        schema: stageInstanceDtoSchema as ZodType<unknown>,
        operation: "stage.transition",
      };
    }

    // POST /api/v1/workflow/gates/:id:decide
    if (
      upperMethod === "POST" &&
      /\/api\/v1\/workflow\/gates\/[^/]+:decide$/.test(pathOnly)
    ) {
      return {
        schema: gateDecisionDtoSchema as ZodType<unknown>,
        operation: "gate.decide",
      };
    }

    // POST /api/v1/workflow/baselines/:id:freeze
    if (
      upperMethod === "POST" &&
      /\/api\/v1\/workflow\/baselines\/[^/]+:freeze$/.test(pathOnly)
    ) {
      return {
        schema: projectBaselineDtoSchema as ZodType<unknown>,
        operation: "baseline.freeze",
      };
    }

    // GET /api/v1/workflow/baselines/:id (详情，非列表)
    if (
      upperMethod === "GET" &&
      /\/api\/v1\/workflow\/baselines\/[^/]+$/.test(pathOnly)
    ) {
      return {
        schema: projectBaselineDtoSchema as ZodType<unknown>,
        operation: "baseline.getById",
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
