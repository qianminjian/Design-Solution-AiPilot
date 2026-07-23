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

  it("应该成功转发文本生成请求到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        id: "gen-1",
        content: "AI生成的设计文本内容",
        tokenUsage: { prompt: 100, completion: 200 },
      }),
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
    expect(response.body).toHaveProperty("id", "gen-1");
    expect(response.body).toHaveProperty("content", "AI生成的设计文本内容");
    expect(response.body).toHaveProperty("tokenUsage");
  });

  it("应该成功转发视觉分析请求到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        id: "vision-1",
        detectedObjects: ["窗户", "门", "墙"],
        confidence: 0.95,
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/capabilities/vision")
      .send({
        imageUrl: "https://example.com/image.png",
        task: "object-detection",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("id", "vision-1");
    expect(response.body).toHaveProperty("detectedObjects");
    expect(response.body).toHaveProperty("confidence", 0.95);
  });

  it("应该成功转发嵌入生成请求到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        id: "embed-1",
        embedding: [0.1, 0.2, 0.3],
        dimensions: 3,
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/capabilities/embeddings")
      .send({
        text: "建筑设计规范",
        model: "text-embedding-3-small",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("id", "embed-1");
    expect(response.body).toHaveProperty("embedding");
    expect(response.body).toHaveProperty("dimensions", 3);
  });

  it("应该在下游返回 429 限流错误时正确透传", async () => {
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
      buildProxyResult({ id: "gen-1", content: "测试内容" }),
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
});
