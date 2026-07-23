import {
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import {
  EmbeddingRequest,
  TextGenerationRequest,
  VisionRequest,
} from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { AiProxyService } from "./ai-proxy.service";

@Controller("v1/capabilities")
@UseInterceptors(ProxyInterceptor)
export class AiCapabilityProxyController {
  constructor(
    @Inject(AiProxyService) private readonly aiProxyService: AiProxyService,
  ) {}

  @Post("text-generation")
  async textGeneration(
    @Req() request: Request,
    @Body() body: TextGenerationRequest,
  ): Promise<ProxyResult> {
    return this.aiProxyService.forwardCapabilities({
      method: "POST",
      path: "/api/v1/capabilities/text-generation",
      body,
      headers: this.extractForwardHeaders(request),
    });
  }

  @Post("vision")
  async vision(
    @Req() request: Request,
    @Body() body: VisionRequest,
  ): Promise<ProxyResult> {
    return this.aiProxyService.forwardCapabilities({
      method: "POST",
      path: "/api/v1/capabilities/vision",
      body,
      headers: this.extractForwardHeaders(request),
    });
  }

  @Post("embeddings")
  async embeddings(
    @Req() request: Request,
    @Body() body: EmbeddingRequest,
  ): Promise<ProxyResult> {
    return this.aiProxyService.forwardCapabilities({
      method: "POST",
      path: "/api/v1/capabilities/embeddings",
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