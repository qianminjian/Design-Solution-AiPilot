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

  it("应该成功转发获取提示词列表请求到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        items: [
          { id: "prompt-1", name: "建筑设计模板", category: "design" },
          { id: "prompt-2", name: "结构分析模板", category: "structure" },
        ],
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/prompts")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("items");
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0]).toHaveProperty("id", "prompt-1");
    expect(response.body.items[0]).toHaveProperty("name", "建筑设计模板");
    expect(response.body.items[1]).toHaveProperty("id", "prompt-2");
    expect(response.body.items[1]).toHaveProperty("name", "结构分析模板");
  });

  it("应该成功转发获取单个提示词请求到 AI Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        id: "prompt-1",
        name: "详细设计模板",
        category: "design",
        content: "这是一个详细的设计提示词模板",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/prompts/prompt-1")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("id", "prompt-1");
    expect(response.body).toHaveProperty("name", "详细设计模板");
    expect(response.body).toHaveProperty("category", "design");
    expect(response.body).toHaveProperty("content");
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
      buildProxyResult({ items: [{ id: "prompt-1", name: "测试模板" }] }),
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
      buildProxyResult({ items: [{ id: "prompt-1", name: "测试模板" }] }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/prompts")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-tenant-id", "tenant-001");
  });
});
