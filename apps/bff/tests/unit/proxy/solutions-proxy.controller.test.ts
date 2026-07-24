import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { SolutionsProxyController } from "../../../src/proxy/ai/solutions-proxy.controller";
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
    originalUrl: "/v1/solutions/generate",
    url: "/v1/solutions/generate",
    path: "/solutions/generate",
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

describe("SolutionsProxyController", () => {
  it("POST generate 应该转发 body 与授权头到 AI Service", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const controller = new SolutionsProxyController(aiProxyService);
    const requestBody = {
      projectId: "p-001",
      template: "concept-generation",
      variables: { buildingType: "office", floors: 10 },
      designOptionId: "opt-001",
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
    vi.mocked(aiProxyService.forwardSolutions).mockResolvedValue(
      createProxyResult(
        {
          candidates: [{ id: "c1", title: "方案 A" }],
          requiresHumanReview: true,
          isAiAssisted: true,
          riskLevel: "medium",
        },
        200,
      ),
    );

    const result = await controller.generate(request, requestBody as any);

    expect(aiProxyService.forwardSolutions).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/api/v1/solutions/generate",
        body: requestBody,
      }),
    );
    const callArgs = vi.mocked(aiProxyService.forwardSolutions).mock
      .calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
      "content-type": "application/json",
    });
    expect(result.status).toBe(200);
  });

  it("应该在请求头未携带 traceId 时使用 request.traceId 兜底", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const controller = new SolutionsProxyController(aiProxyService);
    const request = createRequest({
      method: "POST",
      body: { template: "scheme-deepening" },
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(aiProxyService.forwardSolutions).mockResolvedValue(
      createProxyResult({ candidates: [] }),
    );

    await controller.generate(request, {} as any);

    const callArgs = vi.mocked(aiProxyService.forwardSolutions).mock
      .calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });

  it("应该透传 IDEMPOTENCY_KEY 幂等键头", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const controller = new SolutionsProxyController(aiProxyService);
    const headerMock = vi.fn((name: string) => {
      const map: Record<string, string> = {
        [HttpHeader.AUTHORIZATION]: "Bearer token",
        [HttpHeader.X_TENANT_ID]: "tenant-001",
        [HttpHeader.IDEMPOTENCY_KEY]: "idem-key-001",
        "content-type": "application/json",
      };
      return map[name];
    });
    const request = createRequest({
      method: "POST",
      body: { template: "concept-generation" },
      header: headerMock,
    });
    vi.mocked(aiProxyService.forwardSolutions).mockResolvedValue(
      createProxyResult({ candidates: [] }),
    );

    await controller.generate(request, {} as any);

    const callArgs = vi.mocked(aiProxyService.forwardSolutions).mock
      .calls[0][0];
    expect(callArgs.headers[HttpHeader.IDEMPOTENCY_KEY]).toBe("idem-key-001");
  });
});
