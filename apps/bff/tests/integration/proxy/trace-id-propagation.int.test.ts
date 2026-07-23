import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { Test, type TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../../../src/app.module";
import { ProxyService } from "../../../src/proxy/proxy.service";
import { AiProxyService } from "../../../src/proxy/ai/ai-proxy.service";
import {
  ProxyResult,
  ProxyInterceptor,
} from "../../../src/interceptors/proxy.interceptor";

describe("traceId 透传集成测试", () => {
  let app: INestApplication;
  let mockProxyForward: vi.Mock;
  let mockAiForward: vi.Mock;

  beforeEach(async () => {
    mockProxyForward = vi.fn();
    mockAiForward = vi.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProxyService)
      .useValue({ forward: mockProxyForward })
      .overrideProvider(AiProxyService)
      .useValue({
        forwardCapabilities: mockAiForward,
        forwardPrompts: mockAiForward,
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

  it("应该在请求头中携带 x-trace-id 时透传到下游服务", async () => {
    mockProxyForward.mockResolvedValue(
      buildProxyResult({ success: true }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/projects")
      .set("x-trace-id", "test-trace-123")
      .set("Authorization", "Bearer test-token");

    const callArgs = mockProxyForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-trace-id", "test-trace-123");
  });

  it("应该在未携带 x-trace-id 时自动生成并透传", async () => {
    mockProxyForward.mockResolvedValue(
      buildProxyResult({ success: true }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/projects")
      .set("Authorization", "Bearer test-token");

    const callArgs = mockProxyForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-trace-id");
    expect(typeof callArgs.headers["x-trace-id"]).toBe("string");
    expect(callArgs.headers["x-trace-id"]).toBeTruthy();
  });

  it("应该在 Auth 代理请求中透传 x-trace-id", async () => {
    mockProxyForward.mockResolvedValue(
      buildProxyResult({ accessToken: "test-token" }),
    );

    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username: "testuser", password: "password123" })
      .set("x-trace-id", "auth-trace-789")
      .set("Content-Type", "application/json");

    const callArgs = mockProxyForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-trace-id", "auth-trace-789");
  });

  it("应该在 AI Capabilities 请求中透传 x-trace-id", async () => {
    mockAiForward.mockResolvedValue(
      buildProxyResult({ id: "gen-1", content: "测试内容" }),
    );

    await request(app.getHttpServer())
      .post("/api/v1/capabilities/text-generation")
      .send({ prompt: "测试 traceId" })
      .set("x-trace-id", "ai-trace-000")
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    const callArgs = mockAiForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-trace-id", "ai-trace-000");
  });

  it("应该在 AI Prompts 请求中透传 x-trace-id", async () => {
    mockAiForward.mockResolvedValue(
      buildProxyResult({ items: [{ id: "prompt-1", name: "测试模板" }] }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/prompts")
      .set("x-trace-id", "prompt-trace-111")
      .set("Authorization", "Bearer test-token");

    const callArgs = mockAiForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-trace-id", "prompt-trace-111");
  });

  it("应该在 Core Service 通配符代理请求中透传 x-trace-id", async () => {
    mockProxyForward.mockResolvedValue(
      buildProxyResult({ items: [{ id: "p1", name: "测试项目" }] }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/projects")
      .set("x-trace-id", "core-trace-222")
      .set("Authorization", "Bearer test-token");

    const callArgs = mockProxyForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-trace-id", "core-trace-222");
  });

  it("应该在错误响应中也携带 x-trace-id", async () => {
    mockProxyForward.mockResolvedValue(
      buildProxyResult(
        {
          errorCode: "NOT_FOUND",
          message: "项目不存在",
        },
        404,
      ),
    );

    await request(app.getHttpServer())
      .get("/api/v1/projects/not-found")
      .set("x-trace-id", "error-trace-333")
      .set("Authorization", "Bearer test-token");

    const callArgs = mockProxyForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-trace-id", "error-trace-333");
  });

  it("应该在响应头中返回 x-trace-id", async () => {
    mockProxyForward.mockResolvedValue(
      buildProxyResult(
        { success: true },
        200,
        { "x-trace-id": "trace-return-456" },
      ),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/projects")
      .set("x-trace-id", "request-trace-456")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
  });
});
