import {
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { HttpHeader, GenerateSolutionRequest } from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { AiProxyService } from "./ai-proxy.service";

/**
 * 方案生成代理控制器
 * 转发 /v1/solutions/generate 到 AI Service 的 /api/v1/solutions/generate
 *
 * 所有响应强制 isAiAssisted=true，按风险等级进入人工复核（security.md §12）
 */
@Controller("v1/solutions")
@UseInterceptors(ProxyInterceptor)
export class SolutionsProxyController {
  constructor(
    @Inject(AiProxyService) private readonly aiProxyService: AiProxyService,
  ) {}

  @Post("generate")
  async generate(
    @Req() request: Request,
    @Body() body: GenerateSolutionRequest,
  ): Promise<ProxyResult> {
    return this.aiProxyService.forwardSolutions({
      method: "POST",
      path: "/api/v1/solutions/generate",
      body,
      headers: this.extractForwardHeaders(request),
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
}
