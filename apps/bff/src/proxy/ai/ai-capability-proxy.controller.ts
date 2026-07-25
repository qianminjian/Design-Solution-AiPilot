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
  EmbeddingRequest,
  TextGenerationRequest,
  VisionRequest,
  textGenerationResponseSchema,
  visionResponseSchema,
  embeddingResponseSchema,
} from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { AiProxyService } from "./ai-proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * AI 能力代理控制器
 * 转发 /v1/capabilities/* 到 AI Service 的 /api/v1/capabilities/*
 *
 * 契约验证（security.md §12 AI 安全红线）：
 *  - text-generation / vision：响应必须包含 isAiAssisted=true 与 requiresHumanReview 字段
 *    缺失任一字段即视为 AI Provider 漂移，阻断响应（返回 502）
 *  - embeddings：非生成式 AI（向量化），不触发 AI 安全红线，使用软验证检测契约漂移
 */
@Controller("v1/capabilities")
@UseInterceptors(ProxyInterceptor)
export class AiCapabilityProxyController {
  constructor(
    @Inject(AiProxyService) private readonly aiProxyService: AiProxyService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
  ) {}

  @Post("text-generation")
  async textGeneration(
    @Req() request: Request,
    @Body() body: TextGenerationRequest,
  ): Promise<ProxyResult> {
    const result = await this.aiProxyService.forwardCapabilities({
      method: "POST",
      path: "/api/v1/capabilities/text-generation",
      body,
      headers: this.extractForwardHeaders(request),
    });

    // 仅对 2xx 成功响应执行严格验证
    // 错误响应（429 限流 / 5xx Provider 异常等）应直接透传，不参与契约验证
    if (result.status >= 200 && result.status < 300) {
      const validatedData = this.schemaValidator.validateStrict(
        result.data,
        textGenerationResponseSchema,
        {
          domain: "capabilities",
          operation: "text-generation",
          traceId: request.traceId,
          downstreamService: "ai-service",
        },
      );
      result.data = validatedData;
    }

    return result;
  }

  @Post("vision")
  async vision(
    @Req() request: Request,
    @Body() body: VisionRequest,
  ): Promise<ProxyResult> {
    const result = await this.aiProxyService.forwardCapabilities({
      method: "POST",
      path: "/api/v1/capabilities/vision",
      body,
      headers: this.extractForwardHeaders(request),
    });

    // 视觉理解同样属于 AI 生成响应，触发严格验证
    if (result.status >= 200 && result.status < 300) {
      const validatedData = this.schemaValidator.validateStrict(
        result.data,
        visionResponseSchema,
        {
          domain: "capabilities",
          operation: "vision",
          traceId: request.traceId,
          downstreamService: "ai-service",
        },
      );
      result.data = validatedData;
    }

    return result;
  }

  @Post("embeddings")
  async embeddings(
    @Req() request: Request,
    @Body() body: EmbeddingRequest,
  ): Promise<ProxyResult> {
    const result = await this.aiProxyService.forwardCapabilities({
      method: "POST",
      path: "/api/v1/capabilities/embeddings",
      body,
      headers: this.extractForwardHeaders(request),
    });

    // 向量化为非生成式 AI，使用软验证检测契约漂移（不阻断响应）
    if (result.status >= 200 && result.status < 300) {
      this.schemaValidator.validateSoft(result.data, embeddingResponseSchema, {
        domain: "capabilities",
        operation: "embeddings",
        traceId: request.traceId,
        downstreamService: "ai-service",
      });
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
