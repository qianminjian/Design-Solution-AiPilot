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

describe("Solutions 方案生成代理集成测试", () => {
  let app: INestApplication;
  let mockForward: vi.Mock;

  beforeEach(async () => {
    mockForward = vi.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AiProxyService)
      .useValue({
        forwardCapabilities: vi.fn(),
        forwardPrompts: vi.fn(),
        forwardSolutions: mockForward,
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

  it("应该成功转发方案生成请求到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        candidates: [
          {
            name: "方案 A",
            content: "塔楼 + 裙房方案",
            risks: ["限高紧"],
            feasibilityNotes: "需复核消防",
          },
        ],
        rawContent: "[{...}]",
        model: "gpt-4o",
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        riskLevel: "medium",
        promptTemplateUsed: "concept-generation",
        guardrail: { passed: true, warnings: [], escalatedReview: false },
        isAiAssisted: true,
        requiresHumanReview: true,
        latencyMs: 1234,
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/solutions/generate")
      .send({
        promptTemplate: "concept-generation",
        variables: [
          { key: "siteDescription", value: "上海" },
          { key: "brief", value: "办公塔楼" },
          { key: "referenceImages", value: "无" },
          { key: "constraints", value: "限高 60m" },
        ],
        temperature: 0.7,
        maxTokens: 2048,
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("isAiAssisted", true);
    expect(response.body).toHaveProperty("requiresHumanReview", true);
    expect(response.body).toHaveProperty("riskLevel", "medium");
    expect(response.body).toHaveProperty(
      "promptTemplateUsed",
      "concept-generation",
    );
    expect(response.body.candidates).toHaveLength(1);
    expect(response.body.candidates[0]).toHaveProperty("name", "方案 A");
    expect(response.body.guardrail).toHaveProperty("passed", true);
  });

  it("应该正确转发 Authorization 头到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        candidates: [{ name: "候选", content: "内容" }],
        rawContent: "内容",
        model: "gpt-4o",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        riskLevel: "low",
        promptTemplateUsed: "design-summary",
        guardrail: { passed: true, warnings: [], escalatedReview: false },
        isAiAssisted: true,
        requiresHumanReview: false,
        latencyMs: 100,
      }),
    );

    await request(app.getHttpServer())
      .post("/api/v1/solutions/generate")
      .send({
        promptTemplate: "design-summary",
        variables: [{ key: "content", value: "测试" }],
      })
      .set("Authorization", "Bearer custom-token-456")
      .set("Content-Type", "application/json");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty(
      "authorization",
      "Bearer custom-token-456",
    );
    expect(callArgs.path).toBe("/api/v1/solutions/generate");
    expect(callArgs.method).toBe("POST");
    expect(callArgs.body.promptTemplate).toBe("design-summary");
  });

  it("应该在下游返回 404 模板不存在时正确透传", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          detail: "Prompt 模板不存在: non-existent",
        },
        404,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/solutions/generate")
      .send({
        promptTemplate: "non-existent",
        variables: [{ key: "x", value: "y" }],
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("detail");
  });

  it("应该在下游返回 502 LLM 鉴权失败时正确透传", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          detail: "LLM 鉴权失败，请检查 API Key 配置",
        },
        502,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/solutions/generate")
      .send({
        promptTemplate: "concept-generation",
        variables: [
          { key: "siteDescription", value: "上海" },
          { key: "brief", value: "办公" },
          { key: "referenceImages", value: "无" },
          { key: "constraints", value: "无" },
        ],
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(502);
  });

  it("应该在下游返回 504 LLM 超时时正确透传", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          detail: "LLM 调用超时: timeout",
        },
        504,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/solutions/generate")
      .send({
        promptTemplate: "concept-generation",
        variables: [
          { key: "siteDescription", value: "上海" },
          { key: "brief", value: "办公" },
          { key: "referenceImages", value: "无" },
          { key: "constraints", value: "无" },
        ],
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(504);
  });

  it("应该传递 projectId 与 sketchDocumentId 到下游", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        candidates: [{ name: "候选", content: "内容" }],
        rawContent: "内容",
        model: "gpt-4o",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        riskLevel: "medium",
        promptTemplateUsed: "concept-generation",
        guardrail: { passed: true, warnings: [], escalatedReview: false },
        isAiAssisted: true,
        requiresHumanReview: true,
        latencyMs: 100,
      }),
    );

    await request(app.getHttpServer())
      .post("/api/v1/solutions/generate")
      .send({
        promptTemplate: "concept-generation",
        variables: [
          { key: "siteDescription", value: "上海" },
          { key: "brief", value: "办公" },
          { key: "referenceImages", value: "无" },
          { key: "constraints", value: "无" },
        ],
        projectId: "proj-123",
        sketchDocumentId: "doc-456",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.body.projectId).toBe("proj-123");
    expect(callArgs.body.sketchDocumentId).toBe("doc-456");
  });
});
