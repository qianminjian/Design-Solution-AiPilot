import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { SolutionsProxyController } from "../../../src/proxy/ai/solutions-proxy.controller";
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

/** 合法的方案生成响应 fixture（符合 generateSolutionResponseSchema） */
const validGenerateResponse = {
  candidates: [
    {
      name: "方案 A",
      content: "方案内容 A",
      risks: ["风险点 1"],
      feasibilityNotes: "可行",
    },
  ],
  rawContent: "raw LLM output",
  model: "gpt-4-turbo",
  usage: {
    promptTokens: 100,
    completionTokens: 200,
    totalTokens: 300,
  },
  riskLevel: "medium",
  promptTemplateUsed: "concept-generation",
  guardrail: {
    passed: true,
    warnings: [],
    escalatedReview: false,
  },
  isAiAssisted: true,
  requiresHumanReview: true,
  latencyMs: 1500,
};

describe("SolutionsProxyController", () => {
  it("POST generate 应该转发 body 与授权头到 AI Service", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new SolutionsProxyController(
      aiProxyService,
      schemaValidator,
    );
    const requestBody = {
      promptTemplate: "concept-generation",
      variables: [{ key: "buildingType", value: "office" }],
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
      createProxyResult({ ...validGenerateResponse }, 200),
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
    const schemaValidator = createSchemaValidator();
    const controller = new SolutionsProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      body: { promptTemplate: "scheme-deepening", variables: [] },
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(aiProxyService.forwardSolutions).mockResolvedValue(
      createProxyResult({ ...validGenerateResponse }),
    );

    await controller.generate(request, {} as any);

    const callArgs = vi.mocked(aiProxyService.forwardSolutions).mock
      .calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });

  it("应该透传 IDEMPOTENCY_KEY 幂等键头", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new SolutionsProxyController(
      aiProxyService,
      schemaValidator,
    );
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
      body: { promptTemplate: "concept-generation", variables: [] },
      header: headerMock,
    });
    vi.mocked(aiProxyService.forwardSolutions).mockResolvedValue(
      createProxyResult({ ...validGenerateResponse }),
    );

    await controller.generate(request, {} as any);

    const callArgs = vi.mocked(aiProxyService.forwardSolutions).mock
      .calls[0][0];
    expect(callArgs.headers[HttpHeader.IDEMPOTENCY_KEY]).toBe("idem-key-001");
  });

  it("AI 安全红线：响应缺少 isAiAssisted 应抛 BadGatewayException", async () => {
    // Arrange - 残缺响应缺少 isAiAssisted 与 requiresHumanReview
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new SolutionsProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest();
    const brokenResponse = {
      candidates: [{ name: "A", content: "x", risks: [] }],
      rawContent: "raw",
      model: "gpt-4",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      riskLevel: "medium",
      promptTemplateUsed: "concept-generation",
      guardrail: { passed: true, warnings: [], escalatedReview: false },
      latencyMs: 100,
      // 缺少 isAiAssisted / requiresHumanReview
    };
    vi.mocked(aiProxyService.forwardSolutions).mockResolvedValue(
      createProxyResult(brokenResponse),
    );

    // Act + Assert
    await expect(controller.generate(request, {} as any)).rejects.toMatchObject(
      {
        status: 502,
        response: expect.objectContaining({
          errorCode: "CONTRACT_VALIDATION_FAILED",
        }),
      },
    );
  });

  it("AI 安全红线：isAiAssisted=false 应抛 BadGatewayException", async () => {
    // Arrange - AI 标记被篡改为 false
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new SolutionsProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest();
    const falseFlagResponse = {
      ...validGenerateResponse,
      isAiAssisted: false as const,
    };
    vi.mocked(aiProxyService.forwardSolutions).mockResolvedValue(
      createProxyResult(falseFlagResponse),
    );

    // Act + Assert
    await expect(controller.generate(request, {} as any)).rejects.toMatchObject(
      {
        status: 502,
      },
    );
  });
});
