import {
  Controller,
  Get,
  Inject,
  Param,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { AiProxyService } from "./ai-proxy.service";

@Controller("v1/prompts")
@UseInterceptors(ProxyInterceptor)
export class AiPromptProxyController {
  constructor(
    @Inject(AiProxyService) private readonly aiProxyService: AiProxyService,
  ) {}

  @Get()
  async getPrompts(@Req() request: Request): Promise<ProxyResult> {
    return this.aiProxyService.forwardPrompts({
      method: "GET",
      path: "/api/v1/prompts",
      headers: this.extractForwardHeaders(request),
    });
  }

  @Get(":id")
  async getPromptById(
    @Req() request: Request,
    @Param("id") id: string,
  ): Promise<ProxyResult> {
    return this.aiProxyService.forwardPrompts({
      method: "GET",
      path: `/api/v1/prompts/${id}`,
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