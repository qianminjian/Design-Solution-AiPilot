import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { AiPromptProxyController } from "../../../src/proxy/ai/ai-prompt-proxy.controller";
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

/** 合法的 Prompt 模板 fixture（符合 promptTemplateDtoSchema） */
const validPromptTemplate = {
  name: "concept-generation",
  version: "v1",
  description: "从草图生成概念方案",
  template: "为 {{buildingType}} 生成 {{floors}} 层概念方案",
  variables: ["buildingType", "floors"],
  riskLevel: "medium" as const,
  requiresHumanReview: true,
};

describe("AiPromptProxyController", () => {
  it("GET / 应该转发列表请求到 AI Service 并通过软验证（数组形式）", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiPromptProxyController(
      aiProxyService,
      schemaValidator,
    );
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
      createProxyResult([validPromptTemplate]),
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

  it("GET / 应该通过软验证（包装形式 { items: [] }）", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiPromptProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({ method: "GET" });
    vi.mocked(aiProxyService.forwardPrompts).mockResolvedValue(
      createProxyResult({ items: [validPromptTemplate] }),
    );

    const result = await controller.getPrompts(request);

    expect(result.status).toBe(200);
    expect((result.data as { items: unknown[] }).items).toHaveLength(1);
  });

  it("GET / 软验证失败时应透传响应（不阻断）", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiPromptProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({ method: "GET" });
    // 缺失 riskLevel / requiresHumanReview 字段（不符合 schema）
    const brokenList = [
      {
        id: "prompt-1",
        name: "测试模板",
      },
    ];
    vi.mocked(aiProxyService.forwardPrompts).mockResolvedValue(
      createProxyResult(brokenList),
    );

    const result = await controller.getPrompts(request);

    // 软验证不阻断
    expect(result.status).toBe(200);
    expect(result.data).toEqual(brokenList);
  });

  it("GET /:id 应该转发详情请求到 AI Service 并通过严格 schema 验证", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiPromptProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/prompts/concept-generation",
    });
    vi.mocked(aiProxyService.forwardPrompts).mockResolvedValue(
      createProxyResult({ ...validPromptTemplate }),
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
    expect(result.data).toEqual(validPromptTemplate);
  });

  it("应该在请求头未携带 traceId 时使用 request.traceId 兜底", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiPromptProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(aiProxyService.forwardPrompts).mockResolvedValue(
      createProxyResult([validPromptTemplate]),
    );

    await controller.getPrompts(request);

    const callArgs = vi.mocked(aiProxyService.forwardPrompts).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });

  // ── AI 安全红线契约验证测试（security.md §12） ──

  it("GET /:id 响应缺失 requiresHumanReview 应抛 502（AI 安全红线阻断）", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiPromptProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/prompts/concept-generation",
    });

    // 模拟 AI Provider 漂移：缺失 requiresHumanReview 字段
    const brokenTemplate = {
      ...validPromptTemplate,
      requiresHumanReview: undefined,
    };
    vi.mocked(aiProxyService.forwardPrompts).mockResolvedValue(
      createProxyResult(brokenTemplate, 200),
    );

    await expect(
      controller.getPromptById(request, "concept-generation"),
    ).rejects.toMatchObject({
      status: 502,
      response: {
        errorCode: "CONTRACT_VALIDATION_FAILED",
      },
    });
  });

  it("GET /:id 响应缺失 riskLevel 应抛 502（AI 安全红线阻断）", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiPromptProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/prompts/concept-generation",
    });

    // 缺失 riskLevel 字段（前端依赖此字段决定人工复核等级）
    const brokenTemplate = {
      ...validPromptTemplate,
      riskLevel: undefined,
    };
    vi.mocked(aiProxyService.forwardPrompts).mockResolvedValue(
      createProxyResult(brokenTemplate, 200),
    );

    await expect(
      controller.getPromptById(request, "concept-generation"),
    ).rejects.toMatchObject({
      status: 502,
    });
  });

  it("GET /:id 风险等级为非枚举值应抛 502", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiPromptProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/prompts/concept-generation",
    });

    // riskLevel 必须为 low/medium/high/critical，其他值应阻断
    const brokenTemplate = {
      ...validPromptTemplate,
      riskLevel: "unknown",
    };
    vi.mocked(aiProxyService.forwardPrompts).mockResolvedValue(
      createProxyResult(brokenTemplate, 200),
    );

    await expect(
      controller.getPromptById(request, "concept-generation"),
    ).rejects.toMatchObject({
      status: 502,
    });
  });

  it("非 2xx 状态码响应应直接透传，不触发 schema 验证", async () => {
    const aiProxyService = createAiProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new AiPromptProxyController(
      aiProxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/prompts/not-found",
    });

    // 模拟 404 错误响应
    const errorResponse = {
      errorCode: "PROMPT_NOT_FOUND",
      message: "提示词不存在",
    };
    vi.mocked(aiProxyService.forwardPrompts).mockResolvedValue(
      createProxyResult(errorResponse, 404),
    );

    const result = await controller.getPromptById(request, "not-found");
    expect(result.status).toBe(404);
    expect(result.data).toEqual(errorResponse);
  });
});
