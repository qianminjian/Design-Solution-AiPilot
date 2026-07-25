import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { AiGenerationRecordProxyController } from "../../../src/proxy/ai/ai-generation-record-proxy.controller";
import type { ProxyService } from "../../../src/proxy/proxy.service";
import { SchemaValidator } from "../../../src/proxy/schema-validator.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

/** 构造 ProxyService mock */
function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
}

/** 构造真实 SchemaValidator（无依赖服务，直接实例化） */
function createSchemaValidator(): SchemaValidator {
  return new SchemaValidator();
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
    const controller = new AiGenerationRecordProxyController(
      proxyService,
      createSchemaValidator(),
    );
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
    const controller = new AiGenerationRecordProxyController(
      proxyService,
      createSchemaValidator(),
    );
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
    const controller = new AiGenerationRecordProxyController(
      proxyService,
      createSchemaValidator(),
    );
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
    const controller = new AiGenerationRecordProxyController(
      proxyService,
      createSchemaValidator(),
    );
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
    const controller = new AiGenerationRecordProxyController(
      proxyService,
      createSchemaValidator(),
    );
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

  it("GET /reviews/pending 应该透传路径与 projectId query 到 Core Service", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new AiGenerationRecordProxyController(
      proxyService,
      createSchemaValidator(),
    );
    const request = createRequest({
      method: "GET",
      originalUrl:
        "/api/v1/ai-generation-records/reviews/pending?projectId=proj-001",
      query: { projectId: "proj-001" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    // Act
    await controller.proxy(request);

    // Assert：路径与 query 完整透传，等待 Java Core Controller 路由匹配
    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/api/v1/ai-generation-records/reviews/pending?projectId=proj-001",
        query: { projectId: "proj-001" },
        body: undefined,
      }),
    );
  });

  it("PATCH /{id}/review 应该转发 body 与路径到 Core Service", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new AiGenerationRecordProxyController(
      proxyService,
      createSchemaValidator(),
    );
    const reviewBody = {
      decision: "APPROVED",
      comment: "符合规范要求",
      decisionContext: {
        secondReviewer: "user-002",
        signer: { name: "张工", certificateNo: "REG-001" },
      },
    };
    const headerMock = vi.fn((name: string) => {
      const map: Record<string, string> = {
        [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
        [HttpHeader.X_TENANT_ID]: "tenant-001",
        "x-user-id": "reviewer-001",
        "content-type": "application/json",
      };
      return map[name];
    });
    const request = createRequest({
      method: "PATCH",
      originalUrl: "/api/v1/ai-generation-records/rec-001/review",
      body: reviewBody,
      header: headerMock,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(
        {
          id: "rec-001",
          reviewStatus: "APPROVED",
          reviewerId: "reviewer-001",
        },
        200,
      ),
    );

    // Act
    const result = await controller.proxy(request);

    // Assert：复核决策 body 透传
    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        body: reviewBody,
        path: "/api/v1/ai-generation-records/rec-001/review",
      }),
    );
    // Assert：reviewer-001 通过 x-user-id 透传到 Java Core
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
      "x-user-id": "reviewer-001",
      "content-type": "application/json",
    });
    // Assert：响应状态码
    expect(result.status).toBe(200);
  });

  it("GET /reviews/pending 不携带 body 且不与 /{id} 冲突", async () => {
    // Arrange：验证 reviews 子路径不会被解析为 UUID {id}
    const proxyService = createProxyServiceMock();
    const controller = new AiGenerationRecordProxyController(
      proxyService,
      createSchemaValidator(),
    );
    const request = createRequest({
      method: "GET",
      originalUrl:
        "/api/v1/ai-generation-records/reviews/pending?projectId=proj-001",
      query: { projectId: "proj-001" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    // Act
    await controller.proxy(request);

    // Assert：BFF 通配透传，路径完整保留，路由分发由 Java Core Controller 决定
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.path).toBe(
      "/api/v1/ai-generation-records/reviews/pending?projectId=proj-001",
    );
    expect(callArgs.body).toBeUndefined();
  });
});
