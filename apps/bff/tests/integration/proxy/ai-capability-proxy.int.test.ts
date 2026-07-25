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

describe("AI Capabilities 代理集成测试", () => {
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

  /** 合法的文本生成响应（符合 textGenerationResponseSchema，security.md §12 AI 安全红线） */
  const validTextGenerationResponse = {
    content: "AI生成的设计文本内容",
    model: "gpt-4-turbo",
    finishReason: "stop",
    usage: {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
    },
    isAiAssisted: true,
    requiresHumanReview: true,
    latencyMs: 1200,
  };

  /** 合法的视觉理解响应（符合 visionResponseSchema） */
  const validVisionResponse = {
    content: "图片中检测到窗户、门、墙等建筑构件",
    model: "gpt-4-vision",
    finishReason: "stop",
    usage: {
      promptTokens: 150,
      completionTokens: 80,
      totalTokens: 230,
    },
    isAiAssisted: true,
    requiresHumanReview: true,
    latencyMs: 2000,
  };

  /** 合法的向量化响应（符合 embeddingResponseSchema） */
  const validEmbeddingResponse = {
    embedding: [0.1, 0.2, 0.3],
    dimensions: 3,
    model: "text-embedding-3-small",
    usage: {
      promptTokens: 10,
      completionTokens: 0,
      totalTokens: 10,
    },
    latencyMs: 50,
  };

  it("应该成功转发文本生成请求到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({ ...validTextGenerationResponse }),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/capabilities/text-generation")
      .send({
        prompt: "生成建筑设计方案描述",
        maxTokens: 200,
        temperature: 0.7,
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("content", "AI生成的设计文本内容");
    expect(response.body).toHaveProperty("isAiAssisted", true);
    expect(response.body).toHaveProperty("requiresHumanReview", true);
    expect(response.body).toHaveProperty("model", "gpt-4-turbo");
  });

  it("应该成功转发视觉分析请求到 AI Service", async () => {
    mockForward.mockResolvedValue(buildProxyResult({ ...validVisionResponse }));

    const response = await request(app.getHttpServer())
      .post("/api/v1/capabilities/vision")
      .send({
        imageUrl: "https://example.com/image.png",
        prompt: "描述图片中的建筑构件",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("content");
    expect(response.body).toHaveProperty("isAiAssisted", true);
    expect(response.body).toHaveProperty("requiresHumanReview", true);
  });

  it("应该成功转发嵌入生成请求到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({ ...validEmbeddingResponse }),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/capabilities/embeddings")
      .send({
        input: "建筑设计规范",
        model: "text-embedding-3-small",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("embedding");
    expect(response.body).toHaveProperty("dimensions", 3);
    expect(response.body).toHaveProperty("model", "text-embedding-3-small");
  });

  it("应该在下游返回 429 限流错误时正确透传（不触发 schema 验证）", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          errorCode: "RATE_LIMITED",
          message: "请求过于频繁",
        },
        429,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/capabilities/text-generation")
      .send({ prompt: "测试" })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(429);
    expect(response.body).toHaveProperty("errorCode", "RATE_LIMITED");
    expect(response.body).toHaveProperty("message", "请求过于频繁");
  });

  it("应该在下游返回 503 服务不可用时正确透传", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          errorCode: "SERVICE_UNAVAILABLE",
          message: "AI服务暂时不可用",
        },
        503,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/capabilities/text-generation")
      .send({ prompt: "测试" })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty("errorCode", "SERVICE_UNAVAILABLE");
    expect(response.body).toHaveProperty("message", "AI服务暂时不可用");
  });

  it("应该正确转发 Authorization 头到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({ ...validTextGenerationResponse }),
    );

    await request(app.getHttpServer())
      .post("/api/v1/capabilities/text-generation")
      .send({ prompt: "测试" })
      .set("Authorization", "Bearer custom-token-123")
      .set("Content-Type", "application/json");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty(
      "authorization",
      "Bearer custom-token-123",
    );
  });

  // ── AI 安全红线集成验证（security.md §12） ──

  it("text-generation 响应缺失 isAiAssisted 应返回 502（AI 安全红线阻断）", async () => {
    // 模拟 AI Provider 漂移：缺失 isAiAssisted 字段
    const brokenResponse = {
      ...validTextGenerationResponse,
      isAiAssisted: undefined,
    };
    mockForward.mockResolvedValue(buildProxyResult(brokenResponse));

    const response = await request(app.getHttpServer())
      .post("/api/v1/capabilities/text-generation")
      .send({ prompt: "测试" })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(502);
    expect(response.body).toHaveProperty(
      "errorCode",
      "CONTRACT_VALIDATION_FAILED",
    );
  });

  it("vision 响应缺失 requiresHumanReview 应返回 502", async () => {
    const brokenResponse = {
      ...validVisionResponse,
      requiresHumanReview: undefined,
    };
    mockForward.mockResolvedValue(buildProxyResult(brokenResponse));

    const response = await request(app.getHttpServer())
      .post("/api/v1/capabilities/vision")
      .send({
        imageUrl: "https://example.com/image.png",
        prompt: "描述",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(502);
    expect(response.body).toHaveProperty(
      "errorCode",
      "CONTRACT_VALIDATION_FAILED",
    );
  });

  it("embeddings 软验证失败时应透传响应（不阻断）", async () => {
    // 缺失 dimensions 字段（不符合 schema）
    const brokenResponse = {
      ...validEmbeddingResponse,
      dimensions: undefined,
    };
    mockForward.mockResolvedValue(buildProxyResult(brokenResponse));

    const response = await request(app.getHttpServer())
      .post("/api/v1/capabilities/embeddings")
      .send({ input: "测试" })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    // 软验证不阻断
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("embedding");
  });
});
