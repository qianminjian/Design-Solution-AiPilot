import {
  Controller,
  Get,
  Inject,
  Param,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { HttpHeader, promptTemplateDtoSchema } from "@design-platform/shared";
import { z } from "zod";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { AiProxyService } from "./ai-proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * Prompt 模板列表响应 schema
 * 兼容两种格式：
 *  - 数组形式：[PromptTemplateDto, ...]
 *  - 包装形式：{ items: PromptTemplateDto[] }
 */
const promptTemplateListSchema = z.union([
  z.array(promptTemplateDtoSchema),
  z.object({ items: z.array(promptTemplateDtoSchema) }),
]);

/**
 * Prompt 模板代理控制器
 * 转发 /v1/prompts/* 到 AI Service 的 /api/v1/prompts/*
 *
 * 契约验证策略：
 *  - GET / (列表)：软验证，检测契约漂移但不阻断响应
 *    原因：列表查询响应格式可能存在变体（数组 / 包装），且非安全关键路径
 *  - GET /:id (详情)：严格验证，确保包含 riskLevel 与 requiresHumanReview 字段
 *    原因：前端依赖模板的 riskLevel 决定是否触发人工复核（security.md §12 AI 安全红线）
 *    模板缺少 requiresHumanReview 字段将导致前端误判，跳过人工复核流程
 */
@Controller("v1/prompts")
@UseInterceptors(ProxyInterceptor)
export class AiPromptProxyController {
  constructor(
    @Inject(AiProxyService) private readonly aiProxyService: AiProxyService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
  ) {}

  @Get()
  async getPrompts(@Req() request: Request): Promise<ProxyResult> {
    const result = await this.aiProxyService.forwardPrompts({
      method: "GET",
      path: "/api/v1/prompts",
      headers: this.extractForwardHeaders(request),
    });

    // 列表查询使用软验证：检测契约漂移但不阻断响应
    if (result.status >= 200 && result.status < 300) {
      this.schemaValidator.validateSoft(result.data, promptTemplateListSchema, {
        domain: "prompts",
        operation: "list",
        traceId: request.traceId,
        downstreamService: "ai-service",
      });
    }

    return result;
  }

  @Get(":id")
  async getPromptById(
    @Req() request: Request,
    @Param("id") id: string,
  ): Promise<ProxyResult> {
    const result = await this.aiProxyService.forwardPrompts({
      method: "GET",
      path: `/api/v1/prompts/${id}`,
      headers: this.extractForwardHeaders(request),
    });

    // 详情查询使用严格验证：模板必须包含 riskLevel 与 requiresHumanReview 字段
    // 缺失将导致前端无法正确触发人工复核流程（security.md §12 AI 安全红线）
    if (result.status >= 200 && result.status < 300) {
      const validatedData = this.schemaValidator.validateStrict(
        result.data,
        promptTemplateDtoSchema,
        {
          domain: "prompts",
          operation: "getById",
          traceId: request.traceId,
          downstreamService: "ai-service",
        },
      );
      result.data = validatedData;
    }

    return result;
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
}
