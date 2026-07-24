import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { AiCapabilityProxyController } from "../../../src/proxy/ai/ai-capability-proxy.controller";
import type { AiProxyService } from "../../../src/proxy/ai/ai-proxy.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

function createAiProxyServiceMock(): AiProxyService {
  return {
    forwardSolutions: vi.fn(),
    forwardPrompts: vi.fn(),
    forwardCapabilities: vi.fn(),
  } as unknown as AiProxyService;
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

describe("AiCapabilityProxyController", () => {
  it("POST text-generation 应该转发 body 到 AI Service", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const controller = new AiCapabilityProxyController(aiProxyService);
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
      createProxyResult({
        text: "生成的文本内容",
        usage: { promptTokens: 10, completionTokens: 50 },
      }),
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
  });

  it("POST vision 应该转发 body 到 AI Service", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const controller = new AiCapabilityProxyController(aiProxyService);
    const requestBody = {
      imageUrl: "s3://bucket/image.png",
      prompt: "描述这张图片",
      model: "gpt-4o",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/capabilities/vision",
      body: requestBody,
    });
    vi.mocked(aiProxyService.forwardCapabilities).mockResolvedValue(
      createProxyResult({
        text: "图片描述内容",
        usage: { promptTokens: 100, completionTokens: 50 },
      }),
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
  });

  it("POST embeddings 应该转发 body 到 AI Service", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const controller = new AiCapabilityProxyController(aiProxyService);
    const requestBody = {
      texts: ["文本1", "文本2"],
      model: "text-embedding-3-small",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/capabilities/embeddings",
      body: requestBody,
    });
    vi.mocked(aiProxyService.forwardCapabilities).mockResolvedValue(
      createProxyResult({
        embeddings: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
        usage: { promptTokens: 10 },
      }),
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
  });

  it("应该在请求头未携带 traceId 时使用 request.traceId 兜底", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const controller = new AiCapabilityProxyController(aiProxyService);
    const request = createRequest({
      method: "POST",
      body: { prompt: "test" },
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(aiProxyService.forwardCapabilities).mockResolvedValue(
      createProxyResult({ text: "" }),
    );

    await controller.textGeneration(request, {} as any);

    const callArgs = vi.mocked(aiProxyService.forwardCapabilities).mock
      .calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });
});
