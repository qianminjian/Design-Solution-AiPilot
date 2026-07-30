import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { Request } from "express";
import {
  HttpHeader,
  BIZ_CODE,
  aiRagQueryRequestSchema,
  aiRagQueryResponseSchema,
  createKnowledgeBaseRequestSchema,
  knowledgeBaseListSchema,
  addDocumentsResponseSchema,
  knowledgeBaseMutationResponseSchema,
} from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { AiProxyService } from "./ai-proxy.service";
import { SchemaValidator } from "../schema-validator.service";

/**
 * RAG 知识库代理控制器
 * 转发 /v1/rag/* 到 AI Service 的 /api/v1/rag/*
 *
 * 端点清单（对齐 services/ai/src/rag/router.py）：
 *  - POST /v1/rag/query：检索问答
 *  - POST /v1/rag/knowledge-bases：创建知识库
 *  - GET  /v1/rag/knowledge-bases：列出知识库
 *  - POST /v1/rag/knowledge-bases/:id/documents：添加文档
 *  - DELETE /v1/rag/knowledge-bases/:id：删除知识库
 *
 * 字段适配策略：
 *  - 前端 camelCase（如 knowledgeBaseId）↔ AI Service snake_case（如 knowledge_base_id）
 *  - BFF 代理层负责双向转换，确保前端契约稳定
 *
 * 响应包装策略：
 *  - AI Service 返回裸业务对象（非 ApiResponse<T> 包装）
 *  - BFF 在成功响应时包装为 ApiResponse<T> 格式（{ code:0, data, traceId }）
 *    以兼容前端 apiRequest 的双层状态码校验
 *  - 错误响应（4xx/5xx）保持原样，由 ProxyInterceptor 转 ApiErrorResponse
 *
 * 契约验证（security.md §12 AI 安全红线）：
 *  - /rag/query 响应严格验证：必须包含 isAiAssisted=true 与 requiresHumanReview 字段
 *    缺失即视为 AI Provider 漂移，阻断响应（返回 502）
 *  - 知识库 CRUD 响应软验证：检测契约漂移但不阻断
 */
@Controller("v1/rag")
@UseInterceptors(ProxyInterceptor)
export class RagProxyController {
  constructor(
    @Inject(AiProxyService) private readonly aiProxyService: AiProxyService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
  ) {}

  /**
   * 检索问答
   * 输入：{ knowledgeBaseId, question }（camelCase）
   * 转换为：{ knowledge_base_id, question } 发送到 AI Service
   * 响应：将 snake_case 字段转为 camelCase，并包装为 ApiResponse<T>
   */
  @Post("query")
  async query(
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<ProxyResult> {
    const downstreamBody = this.transformQueryRequest(body);

    const result = await this.aiProxyService.forwardRag({
      method: "POST",
      path: "/api/v1/rag/query",
      body: downstreamBody,
      headers: this.extractForwardHeaders(request),
    });

    if (result.status >= 200 && result.status < 300) {
      const transformed = this.transformQueryResponse(result.data);
      const validatedData = this.schemaValidator.validateStrict(
        transformed,
        aiRagQueryResponseSchema,
        {
          domain: "rag",
          operation: "query",
          traceId: request.traceId,
          downstreamService: "ai-service",
        },
      );
      result.data = this.wrapApiResponse(validatedData, request.traceId);
    }

    return result;
  }

  /**
   * 创建知识库
   * 输入：{ knowledgeBaseId }
   * 转换为：{ knowledge_base_id } 发送到 AI Service
   */
  @Post("knowledge-bases")
  async createKnowledgeBase(
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<ProxyResult> {
    const downstreamBody = this.transformCreateRequest(body);

    const result = await this.aiProxyService.forwardRag({
      method: "POST",
      path: "/api/v1/rag/knowledge-bases",
      body: downstreamBody,
      headers: this.extractForwardHeaders(request),
    });

    if (result.status >= 200 && result.status < 300) {
      const transformed = this.transformMutationResponse(result.data);
      this.schemaValidator.validateSoft(
        transformed,
        knowledgeBaseMutationResponseSchema,
        {
          domain: "rag",
          operation: "createKnowledgeBase",
          traceId: request.traceId,
          downstreamService: "ai-service",
        },
      );
      result.data = this.wrapApiResponse(transformed, request.traceId);
    }

    return result;
  }

  /**
   * 列出知识库
   * 响应：将 snake_case 字段（如 document_count）转为 camelCase，并包装为 ApiResponse<T>
   */
  @Get("knowledge-bases")
  async listKnowledgeBases(@Req() request: Request): Promise<ProxyResult> {
    const result = await this.aiProxyService.forwardRag({
      method: "GET",
      path: "/api/v1/rag/knowledge-bases",
      headers: this.extractForwardHeaders(request),
    });

    if (result.status >= 200 && result.status < 300) {
      const transformed = this.transformKnowledgeBaseList(result.data);
      this.schemaValidator.validateSoft(transformed, knowledgeBaseListSchema, {
        domain: "rag",
        operation: "listKnowledgeBases",
        traceId: request.traceId,
        downstreamService: "ai-service",
      });
      result.data = this.wrapApiResponse(transformed, request.traceId);
    }

    return result;
  }

  /**
   * 添加文档到知识库
   * 路径参数 knowledgeBaseId 已是 snake_case 兼容形式，直接透传
   */
  @Post("knowledge-bases/:id/documents")
  async addDocuments(
    @Req() request: Request,
    @Param("id") knowledgeBaseId: string,
    @Body() body: unknown,
  ): Promise<ProxyResult> {
    const result = await this.aiProxyService.forwardRag({
      method: "POST",
      path: `/api/v1/rag/knowledge-bases/${encodeURIComponent(knowledgeBaseId)}/documents`,
      body,
      headers: this.extractForwardHeaders(request),
    });

    if (result.status >= 200 && result.status < 300) {
      const transformed = this.transformAddDocumentsResponse(result.data);
      this.schemaValidator.validateSoft(
        transformed,
        addDocumentsResponseSchema,
        {
          domain: "rag",
          operation: "addDocuments",
          traceId: request.traceId,
          downstreamService: "ai-service",
        },
      );
      result.data = this.wrapApiResponse(transformed, request.traceId);
    }

    return result;
  }

  /**
   * 删除知识库
   */
  @Delete("knowledge-bases/:id")
  async deleteKnowledgeBase(
    @Req() request: Request,
    @Param("id") knowledgeBaseId: string,
  ): Promise<ProxyResult> {
    const result = await this.aiProxyService.forwardRag({
      method: "DELETE",
      path: `/api/v1/rag/knowledge-bases/${encodeURIComponent(knowledgeBaseId)}`,
      headers: this.extractForwardHeaders(request),
    });

    if (result.status >= 200 && result.status < 300) {
      const transformed = this.transformMutationResponse(result.data);
      this.schemaValidator.validateSoft(
        transformed,
        knowledgeBaseMutationResponseSchema,
        {
          domain: "rag",
          operation: "deleteKnowledgeBase",
          traceId: request.traceId,
          downstreamService: "ai-service",
        },
      );
      result.data = this.wrapApiResponse(transformed, request.traceId);
    }

    return result;
  }

  // ── 字段转换工具 ──

  /**
   * 将业务对象包装为 ApiResponse<T> 格式
   * 前端 apiRequest 期望 { code:0, data:T, traceId } 包装，AI Service 返回裸对象需手动包装
   */
  private wrapApiResponse(
    data: unknown,
    traceId?: string,
  ): {
    code: typeof BIZ_CODE.SUCCESS;
    data: unknown;
    message: string;
    traceId: string;
  } {
    return {
      code: BIZ_CODE.SUCCESS,
      data,
      message: "",
      traceId: traceId ?? "",
    };
  }

  /**
   * 检索问答请求：camelCase → snake_case
   * 前端传入 { knowledgeBaseId, question }
   * 转换为 { knowledge_base_id, question } 发送到 AI Service
   */
  private transformQueryRequest(body: unknown): Record<string, unknown> {
    const parsed = aiRagQueryRequestSchema.safeParse(body);
    if (!parsed.success) {
      // 校验失败时透传原始 body，由 AI Service 返回 422 错误
      return (body as Record<string, unknown>) ?? {};
    }
    return {
      knowledge_base_id: parsed.data.knowledgeBaseId,
      question: parsed.data.question,
    };
  }

  /**
   * 检索问答响应：snake_case → camelCase
   * AI Service 返回 { conclusion, citations: [{ chunk_id, document_id, ... }], uncertainty, model_version, retrieval_time_ms, requires_human_review, is_ai_assisted }
   * 转换为前端契约 { conclusion, citations: [{ chunkId, documentId, ... }], uncertainty, modelVersion, retrievalTimeMs, requiresHumanReview, isAiAssisted }
   */
  private transformQueryResponse(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== "object") {
      return {};
    }
    const raw = data as Record<string, unknown>;
    const citations = Array.isArray(raw.citations)
      ? raw.citations.map((c) => this.transformCitation(c))
      : [];
    return {
      conclusion: raw.conclusion,
      citations,
      uncertainty: raw.uncertainty,
      modelVersion: raw.model_version ?? raw.modelVersion,
      retrievalTimeMs: raw.retrieval_time_ms ?? raw.retrievalTimeMs,
      requiresHumanReview: raw.requires_human_review ?? raw.requiresHumanReview,
      isAiAssisted: raw.is_ai_assisted ?? raw.isAiAssisted,
    };
  }

  /** 单条引用来源字段转换 */
  private transformCitation(c: unknown): Record<string, unknown> {
    if (!c || typeof c !== "object") return {};
    const raw = c as Record<string, unknown>;
    return {
      chunkId: raw.chunk_id ?? raw.chunkId,
      documentId: raw.document_id ?? raw.documentId,
      title: raw.title,
      section: raw.section,
      content: raw.content,
      score: raw.score,
    };
  }

  /** 创建知识库请求：camelCase → snake_case */
  private transformCreateRequest(body: unknown): Record<string, unknown> {
    const parsed = createKnowledgeBaseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return (body as Record<string, unknown>) ?? {};
    }
    return { knowledge_base_id: parsed.data.knowledgeBaseId };
  }

  /**
   * 列出知识库响应：snake_case → camelCase
   * 兼容数组形式与包装形式
   */
  private transformKnowledgeBaseList(data: unknown): unknown {
    if (Array.isArray(data)) {
      return data.map((kb) => this.transformKnowledgeBase(kb));
    }
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.items)) {
        return {
          items: obj.items.map((kb) => this.transformKnowledgeBase(kb)),
        };
      }
    }
    return data;
  }

  /** 单个知识库信息字段转换 */
  private transformKnowledgeBase(kb: unknown): Record<string, unknown> {
    if (!kb || typeof kb !== "object") return {};
    const raw = kb as Record<string, unknown>;
    return {
      id: raw.id,
      documentCount: raw.document_count ?? raw.documentCount,
    };
  }

  /** 添加文档响应：snake_case → camelCase */
  private transformAddDocumentsResponse(
    data: unknown,
  ): Record<string, unknown> {
    if (!data || typeof data !== "object") return {};
    const raw = data as Record<string, unknown>;
    return {
      status: raw.status,
      knowledgeBaseId: raw.knowledge_base_id ?? raw.knowledgeBaseId,
      chunkCount: raw.chunk_count ?? raw.chunkCount,
    };
  }

  /** 创建/删除知识库响应：snake_case → camelCase */
  private transformMutationResponse(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== "object") return {};
    const raw = data as Record<string, unknown>;
    return {
      status: raw.status,
      knowledgeBaseId: raw.knowledge_base_id ?? raw.knowledgeBaseId,
    };
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
}
