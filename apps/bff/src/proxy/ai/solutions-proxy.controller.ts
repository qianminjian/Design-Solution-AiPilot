import {
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import {
  HttpHeader,
  GenerateSolutionRequest,
  generateSolutionResponseSchema,
} from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { AiProxyService } from "./ai-proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * 方案生成代理控制器
 * 转发 /v1/solutions/generate 到 AI Service 的 /api/v1/solutions/generate
 *
 * 契约验证（security.md §12 AI 安全红线）：
 *  - 响应必须包含 isAiAssisted=true 与 requiresHumanReview 字段
 *  - 缺失任一字段即视为 AI Provider 漂移，阻断响应（返回 502）
 *  - 防止前端拿到未标记 AI 辅助的方案数据，导致跳过人工复核
 */
@Controller("v1/solutions")
@UseInterceptors(ProxyInterceptor)
export class SolutionsProxyController {
  constructor(
    @Inject(AiProxyService) private readonly aiProxyService: AiProxyService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
  ) {}

  @Post("generate")
  async generate(
    @Req() request: Request,
    @Body() body: GenerateSolutionRequest,
  ): Promise<ProxyResult> {
    const result = await this.aiProxyService.forwardSolutions({
      method: "POST",
      path: "/api/v1/solutions/generate",
      body,
      headers: this.extractForwardHeaders(request),
    });

    // 仅对 2xx 成功响应执行严格验证
    // 错误响应（404 模板不存在 / 502 LLM 鉴权失败 / 504 LLM 超时等）应直接透传，不参与契约验证
    // 防止 AI Provider 漂移导致 isAiAssisted / requiresHumanReview 字段缺失
    if (result.status >= 200 && result.status < 300) {
      const validatedData = this.schemaValidator.validateStrict(
        result.data,
        generateSolutionResponseSchema,
        {
          domain: "solutions",
          operation: "generate",
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
