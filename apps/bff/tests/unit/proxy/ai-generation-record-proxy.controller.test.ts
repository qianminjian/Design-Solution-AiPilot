import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { AiGenerationRecordProxyController } from "../../../src/proxy/ai/ai-generation-record-proxy.controller";
import type { ProxyService } from "../../../src/proxy/proxy.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

/** 构造 ProxyService mock */
function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
}

/** 构造 Express Request mock */
function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/api/v1/ai-generation-records",
    url: "/api/v1/ai-generation-records",
    path: "/ai-generation-records",
    query: {},
    body: undefined,
    traceId: "test-trace-id-123",
    header: vi.fn(() => undefined),
    headers: {},
    ...overrides,
  } as unknown as Request;
}

/** 构造 ProxyResult */
function createProxyResult<T>(data: T, status = 200): ProxyResult {
  return { status, data, headers: {} };
}

describe("AiGenerationRecordProxyController", () => {
  it("POST 创建请求应该转发 body 与授权头到 Core Service", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new AiGenerationRecordProxyController(proxyService);
    const requestBody = {
      projectId: "p-001",
      promptTemplate: "concept-generation",
      renderedPrompt: "prompt text",
      rawContent: "raw content",
      candidates: {},
      model: "gpt-4o",
      tokenUsage: {},
      riskLevel: "medium",
      guardrailResult: { passed: true },
    };
    const headerMock = vi.fn((name: string) => {
      const map: Record<string, string> = {
        [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
        [HttpHeader.X_TENANT_ID]: "tenant-001",
        "x-user-id": "user-001",
        "content-type": "application/json",
      };
      return map[name];
    });
    const request = createRequest({
      method: "POST",
      originalUrl: "/api/v1/ai-generation-records",
      body: requestBody,
      header: headerMock,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "rec-001" }, 201),
    );

    // Act
    const result = await controller.proxy(request);

    // Assert：body 转发
    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: requestBody,
        path: "/api/v1/ai-generation-records",
      }),
    );
    // Assert：关键头透传
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
      "x-user-id": "user-001",
      "content-type": "application/json",
    });
    // Assert：traceId 透传（request.traceId 兜底）
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("test-trace-id-123");
    expect(result.status).toBe(201);
  });

  it("GET 按 designOptionId 查询应该不携带 body", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new AiGenerationRecordProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/api/v1/ai-generation-records?designOptionId=opt-001",
      query: { designOptionId: "opt-001" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    // Act
    await controller.proxy(request);

    // Assert：GET 不携带 body
    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        body: undefined,
        query: { designOptionId: "opt-001" },
      }),
    );
  });

  it("应该在请求头未携带 traceId 时使用 request.traceId 兜底", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new AiGenerationRecordProxyController(proxyService);
    const request = createRequest({
      method: "POST",
      originalUrl: "/api/v1/ai-generation-records",
      body: {},
      // header 不返回 x-trace-id，强制走兜底逻辑
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "rec-001" }),
    );

    // Act
    await controller.proxy(request);

    // Assert：traceId 走兜底
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });

  it("应该规范化 query 参数（数组过滤非字符串）", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new AiGenerationRecordProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl:
        "/api/v1/ai-generation-records?projectId=p1&category=a&category=b",
      query: {
        projectId: "p1",
        category: ["a", "b"],
      },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    // Act
    await controller.proxy(request);

    // Assert
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.query).toEqual({ projectId: "p1", category: ["a", "b"] });
  });

  it("DELETE 请求应该不携带 body", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new AiGenerationRecordProxyController(proxyService);
    const request = createRequest({
      method: "DELETE",
      originalUrl: "/api/v1/ai-generation-records/rec-001",
      body: { ignored: true },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(null, 204),
    );

    // Act
    await controller.proxy(request);

    // Assert
    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        body: undefined,
      }),
    );
  });
});
