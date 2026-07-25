import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { AiCapabilityProxyController } from "../../../src/proxy/ai/ai-capability-proxy.controller";
import type { AiProxyService } from "../../../src/proxy/ai/ai-proxy.service";
import { SchemaValidator } from "../../../src/proxy/schema-validator.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

function createAiProxyServiceMock(): AiProxyService {
  return {
    forwardSolutions: vi.fn(),
    forwardPrompts: vi.fn(),
    forwardCapabilities: vi.fn(),
  } as unknown as AiProxyService;
}

/** 构造真实 SchemaValidator（无依赖服务，直接实例化） */
function createSchemaValidator(): SchemaValidator {
  return new SchemaValidator();
}

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "POST",
    originalUrl: "/v1/capabilities/text-generation",
    url: "/v1/capabilities/text-generation",
    path: "/capabilities/text-generation",
    query: {},
    body: undefined,
    traceId: "test-trace-id-123",
    header: vi.fn(() => undefined),
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createProxyResult<T>(data: T, status = 200): ProxyResult {
  return { status, data, headers: {} };
}

/** 合法的文本生成响应 fixture（符合 textGenerationResponseSchema） */
const validTextGenerationResponse = {
  content: "生成的文本内容",
  model: "gpt-4-turbo",
  finishReason: "stop",
  usage: {
    promptTokens: 10,
    completionTokens: 50,
    totalTokens: 60,
  },
  isAiAssisted: true,
  requiresHumanReview: true,
  latencyMs: 1200,
};

/** 合法的视觉理解响应 fixture（符合 visionResponseSchema） */
const validVisionResponse = {
  content: "图片描述内容",
  model: "gpt-4-vision",
  finishReason: "stop",
  usage: {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
  },
  isAiAssisted: true,
  requiresHumanReview: true,
  latencyMs: 2000,
};

/** 合法的向量化响应 fixture（符合 embeddingResponseSchema） */
const validEmbeddingResponse = {
  embedding: [0.1, 0.2, 0.3],
  dimensions: 3,
  model: "text-embedding-3-small",
  usage: {
    promptTokens: 10,
    completionTokens: 0,
    totalTokens: 10,
  },
  latencyMs: 100,
};

describe("AiCapabilityProxyController", () => {
  it("POST text-generation 应该转发 body 到 AI Service 并通过严格 schema 验证", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiCapabilityProxyController(
      aiProxyService,
      schemaValidator,
    );
    const requestBody = {
      prompt: "描述一个办公建筑",
      model: "gpt-4o",
      maxTokens: 1000,
    };
    const headerMock = vi.fn((name: string) => {
      const map: Record<string, string> = {
        [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
        [HttpHeader.X_TENANT_ID]: "tenant-001",
        "content-type": "application/json",
      };
      return map[name];
    });
    const request = createRequest({
      method: "POST",
      body: requestBody,
      header: headerMock,
    });
    vi.mocked(aiProxyService.forwardCapabilities).mockResolvedValue(
      createProxyResult({ ...validTextGenerationResponse }, 200),
    );

    const result = await controller.textGeneration(request, requestBody as any);

    expect(aiProxyService.forwardCapabilities).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/api/v1/capabilities/text-generation",
        body: requestBody,
      }),
    );
    const callArgs = vi.mocked(aiProxyService.forwardCapabilities).mock
      .calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
      "content-type": "application/json",
    });
    expect(result.status).toBe(200);
    expect(result.data).toEqual(validTextGenerationResponse);
  });

  it("POST vision 应该转发 body 到 AI Service 并通过严格 schema 验证", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiCapabilityProxyController(
      aiProxyService,
      schemaValidator,
    );
    const requestBody = {
      imageUrl: "https://example.com/image.png",
      prompt: "描述这张图片",
      model: "gpt-4o",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/capabilities/vision",
      body: requestBody,
    });
    vi.mocked(aiProxyService.forwardCapabilities).mockResolvedValue(
      createProxyResult({ ...validVisionResponse }, 200),
    );

    const result = await controller.vision(request, requestBody as any);

    expect(aiProxyService.forwardCapabilities).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/api/v1/capabilities/vision",
        body: requestBody,
      }),
    );
    expect(result.status).toBe(200);
    expect(result.data).toEqual(validVisionResponse);
  });

  it("POST embeddings 应该转发 body 到 AI Service 并通过软验证（不阻断）", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiCapabilityProxyController(
      aiProxyService,
      schemaValidator,
    );
    const requestBody = {
      input: "文本1",
      model: "text-embedding-3-small",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/capabilities/embeddings",
      body: requestBody,
    });
    vi.mocked(aiProxyService.forwardCapabilities).mockResolvedValue(
      createProxyResult({ ...validEmbeddingResponse }, 200),
    );

    const result = await controller.embeddings(request, requestBody as any);

    expect(aiProxyService.forwardCapabilities).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/api/v1/capabilities/embeddings",
        body: requestBody,
      }),
    );
    expect(result.status).toBe(200);
    // 软验证通过后数据透传
    expect(result.data).toEqual(validEmbeddingResponse);
  });

  it("应该在请求头未携带 traceId 时使用 request.traceId 兜底", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiCapabilityProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      body: { prompt: "test" },
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(aiProxyService.forwardCapabilities).mockResolvedValue(
      createProxyResult({ ...validTextGenerationResponse }, 200),
    );

    await controller.textGeneration(request, {} as any);

    const callArgs = vi.mocked(aiProxyService.forwardCapabilities).mock
      .calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });

  // ── AI 安全红线契约验证测试（security.md §12） ──

  it("text-generation 响应缺失 isAiAssisted 应抛 502（AI 安全红线阻断）", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiCapabilityProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({ method: "POST", body: { prompt: "x" } });

    // 缺失 isAiAssisted 字段（模拟 AI Provider 漂移）
    const brokenResponse = {
      ...validTextGenerationResponse,
      isAiAssisted: undefined,
    };
    vi.mocked(aiProxyService.forwardCapabilities).mockResolvedValue(
      createProxyResult(brokenResponse, 200),
    );

    await expect(
      controller.textGeneration(request, {} as any),
    ).rejects.toMatchObject({
      status: 502,
      response: {
        errorCode: "CONTRACT_VALIDATION_FAILED",
      },
    });
  });

  it("text-generation 响应缺失 requiresHumanReview 应抛 502", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiCapabilityProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({ method: "POST", body: { prompt: "x" } });

    // isAiAssisted 不为字面量 true（违反 z.literal(true)）
    const brokenResponse = {
      ...validTextGenerationResponse,
      isAiAssisted: false, // 必须为 true
    };
    vi.mocked(aiProxyService.forwardCapabilities).mockResolvedValue(
      createProxyResult(brokenResponse, 200),
    );

    await expect(
      controller.textGeneration(request, {} as any),
    ).rejects.toMatchObject({
      status: 502,
    });
  });

  it("vision 响应缺失 requiresHumanReview 应抛 502（AI 安全红线阻断）", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiCapabilityProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/capabilities/vision",
      body: { imageUrl: "https://x.com/y.png", prompt: "describe" },
    });

    const brokenResponse = {
      ...validVisionResponse,
      requiresHumanReview: undefined,
    };
    vi.mocked(aiProxyService.forwardCapabilities).mockResolvedValue(
      createProxyResult(brokenResponse, 200),
    );

    await expect(controller.vision(request, {} as any)).rejects.toMatchObject({
      status: 502,
    });
  });

  it("embeddings 软验证失败时不应抛异常（数据透传）", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiCapabilityProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/capabilities/embeddings",
      body: { input: "x" },
    });

    // 缺失 dimensions 字段（不符合 schema）
    const brokenResponse = {
      ...validEmbeddingResponse,
      dimensions: undefined,
    };
    vi.mocked(aiProxyService.forwardCapabilities).mockResolvedValue(
      createProxyResult(brokenResponse, 200),
    );

    // 软验证不抛异常
    const result = await controller.embeddings(request, {} as any);
    expect(result.status).toBe(200);
    // 数据原样透传
    expect(result.data).toEqual(brokenResponse);
  });

  it("非 2xx 状态码响应应直接透传，不触发 schema 验证", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiCapabilityProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({ method: "POST", body: { prompt: "x" } });

    // 模拟 502 错误响应（如 LLM Provider 鉴权失败）
    const errorResponse = {
      errorCode: "LLM_AUTH_FAILED",
      message: "Invalid API key",
    };
    vi.mocked(aiProxyService.forwardCapabilities).mockResolvedValue(
      createProxyResult(errorResponse, 502),
    );

    const result = await controller.textGeneration(request, {} as any);
    expect(result.status).toBe(502);
    expect(result.data).toEqual(errorResponse);
  });
});
