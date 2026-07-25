import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { Test, type TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../../../src/app.module";
import { AiProxyService } from "../../../src/proxy/ai/ai-proxy.service";
import {
  ProxyResult,
  ProxyInterceptor,
} from "../../../src/interceptors/proxy.interceptor";

describe("AI Prompts 代理集成测试", () => {
  let app: INestApplication;
  let mockForward: vi.Mock;

  beforeEach(async () => {
    mockForward = vi.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiProxyService)
      .useValue({
        forwardCapabilities: mockForward,
        forwardPrompts: mockForward,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalInterceptors(new ProxyInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    vi.clearAllMocks();
  });

  function buildProxyResult(
    data: unknown,
    status = 200,
    headers: Record<string, string> = {},
  ): ProxyResult {
    return { status, data, headers };
  }

  /** 合法的 Prompt 模板 fixture（符合 promptTemplateDtoSchema） */
  const validPromptTemplate = {
    name: "concept-generation",
    version: "v1",
    description: "从草图生成概念方案",
    template: "为 {{buildingType}} 生成 {{floors}} 层概念方案",
    variables: ["buildingType", "floors"],
    riskLevel: "medium",
    requiresHumanReview: true,
  };

  it("应该成功转发获取提示词列表请求到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({ items: [validPromptTemplate] }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/prompts")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("items");
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toHaveProperty("name", "concept-generation");
    expect(response.body.items[0]).toHaveProperty("riskLevel", "medium");
    expect(response.body.items[0]).toHaveProperty("requiresHumanReview", true);
  });

  it("应该成功转发数组形式的提示词列表响应", async () => {
    mockForward.mockResolvedValue(buildProxyResult([validPromptTemplate]));

    const response = await request(app.getHttpServer())
      .get("/api/v1/prompts")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toHaveProperty("name", "concept-generation");
  });

  it("应该成功转发获取单个提示词请求到 AI Service", async () => {
    mockForward.mockResolvedValue(buildProxyResult({ ...validPromptTemplate }));

    const response = await request(app.getHttpServer())
      .get("/api/v1/prompts/concept-generation")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("name", "concept-generation");
    expect(response.body).toHaveProperty("version", "v1");
    expect(response.body).toHaveProperty("riskLevel", "medium");
    expect(response.body).toHaveProperty("requiresHumanReview", true);
  });

  it("应该在下游返回 404 时正确透传错误响应", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          errorCode: "PROMPT_NOT_FOUND",
          message: "提示词不存在",
        },
        404,
      ),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/prompts/not-found")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errorCode", "PROMPT_NOT_FOUND");
    expect(response.body).toHaveProperty("message", "提示词不存在");
  });

  it("应该正确转发 x-trace-id 头到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({ items: [validPromptTemplate] }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/prompts")
      .set("Authorization", "Bearer test-token")
      .set("x-trace-id", "test-trace-id-001");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-trace-id", "test-trace-id-001");
  });

  it("应该正确转发 x-tenant-id 头到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({ items: [validPromptTemplate] }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/prompts")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-tenant-id", "tenant-001");
  });

  // ── AI 安全红线集成验证（security.md §12） ──

  it("GET /:id 响应缺失 requiresHumanReview 应返回 502（AI 安全红线阻断）", async () => {
    // 模拟 AI Provider 漂移：缺失 requiresHumanReview 字段
    const brokenTemplate = {
      ...validPromptTemplate,
      requiresHumanReview: undefined,
    };
    mockForward.mockResolvedValue(buildProxyResult(brokenTemplate));

    const response = await request(app.getHttpServer())
      .get("/api/v1/prompts/concept-generation")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(502);
    expect(response.body).toHaveProperty(
      "errorCode",
      "CONTRACT_VALIDATION_FAILED",
    );
  });

  it("GET /:id 响应缺失 riskLevel 应返回 502", async () => {
    const brokenTemplate = {
      ...validPromptTemplate,
      riskLevel: undefined,
    };
    mockForward.mockResolvedValue(buildProxyResult(brokenTemplate));

    const response = await request(app.getHttpServer())
      .get("/api/v1/prompts/concept-generation")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(502);
    expect(response.body).toHaveProperty(
      "errorCode",
      "CONTRACT_VALIDATION_FAILED",
    );
  });

  it("GET / 列表软验证失败时应透传响应（不阻断）", async () => {
    // 缺失 riskLevel / requiresHumanReview 字段
    const brokenList = [
      {
        id: "prompt-1",
        name: "测试模板",
      },
    ];
    mockForward.mockResolvedValue(buildProxyResult(brokenList));

    const response = await request(app.getHttpServer())
      .get("/api/v1/prompts")
      .set("Authorization", "Bearer test-token");

    // 软验证不阻断
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });
});
