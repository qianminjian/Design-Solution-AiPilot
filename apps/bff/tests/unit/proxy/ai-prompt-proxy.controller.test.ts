import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { AiPromptProxyController } from "../../../src/proxy/ai/ai-prompt-proxy.controller";
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
    method: "GET",
    originalUrl: "/v1/prompts",
    url: "/v1/prompts",
    path: "/prompts",
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

describe("AiPromptProxyController", () => {
  it("GET / 应该转发列表请求到 AI Service", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const controller = new AiPromptProxyController(aiProxyService);
    const headerMock = vi.fn((name: string) => {
      const map: Record<string, string> = {
        [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
        [HttpHeader.X_TENANT_ID]: "tenant-001",
      };
      return map[name];
    });
    const request = createRequest({
      method: "GET",
      header: headerMock,
    });
    vi.mocked(aiProxyService.forwardPrompts).mockResolvedValue(
      createProxyResult({
        items: [
          { id: "concept-generation", name: "概念生成" },
          { id: "scheme-deepening", name: "方案深化" },
        ],
      }),
    );

    const result = await controller.getPrompts(request);

    expect(aiProxyService.forwardPrompts).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/api/v1/prompts",
      }),
    );
    const callArgs = vi.mocked(aiProxyService.forwardPrompts).mock.calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
    });
    expect(result.status).toBe(200);
  });

  it("GET /:id 应该转发详情请求到 AI Service", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const controller = new AiPromptProxyController(aiProxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/prompts/concept-generation",
    });
    vi.mocked(aiProxyService.forwardPrompts).mockResolvedValue(
      createProxyResult({
        id: "concept-generation",
        name: "概念生成",
        description: "从草图生成概念方案",
        variables: ["buildingType", "floors"],
      }),
    );

    const result = await controller.getPromptById(
      request,
      "concept-generation",
    );

    expect(aiProxyService.forwardPrompts).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/api/v1/prompts/concept-generation",
      }),
    );
    expect(result.status).toBe(200);
  });

  it("应该在请求头未携带 traceId 时使用 request.traceId 兜底", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const controller = new AiPromptProxyController(aiProxyService);
    const request = createRequest({
      method: "GET",
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(aiProxyService.forwardPrompts).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.getPrompts(request);

    const callArgs = vi.mocked(aiProxyService.forwardPrompts).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });
});
