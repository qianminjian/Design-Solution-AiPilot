import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { Test, type TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../../../src/app.module";
import { ProxyService } from "../../../src/proxy/proxy.service";
import {
  ProxyResult,
  ProxyInterceptor,
} from "../../../src/interceptors/proxy.interceptor";

/**
 * AI 生成记录代理控制器集成测试
 * 覆盖 /api/v1/ai-generation-records/* 转发到 Core Service 的核心场景
 */
describe("AI 生成记录代理集成测试", () => {
  let app: INestApplication;
  let mockForward: vi.Mock;

  beforeEach(async () => {
    mockForward = vi.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProxyService)
      .useValue({ forward: mockForward })
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

  it("应该成功转发 GET /api/v1/ai-generation-records 按项目查询", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: [
          {
            id: "rec-001",
            projectId: "proj-001",
            designOptionId: "opt-001",
            provider: "openai",
            model: "gpt-4",
            traceId: "trace-001",
            status: "COMPLETED",
            requiresHumanReview: true,
            isAiAssisted: true,
            createdAt: "2026-07-24T10:00:00Z",
          },
          {
            id: "rec-002",
            projectId: "proj-001",
            designOptionId: "opt-002",
            provider: "openai",
            model: "gpt-4",
            traceId: "trace-002",
            status: "PENDING_REVIEW",
            requiresHumanReview: true,
            isAiAssisted: true,
            createdAt: "2026-07-24T11:00:00Z",
          },
        ],
        message: "success",
        traceId: "agg-trace-001",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records")
      .query({ projectId: "proj-001" })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("code", 0);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toHaveProperty("id", "rec-001");
    expect(response.body.data[0]).toHaveProperty("requiresHumanReview", true);
    expect(response.body.data[1]).toHaveProperty("status", "PENDING_REVIEW");
  });

  it("应该成功转发 POST /api/v1/ai-generation-records 创建记录", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 0,
          data: {
            id: "rec-003",
            projectId: "proj-001",
            designOptionId: "opt-001",
            provider: "openai",
            model: "gpt-4",
            traceId: "trace-003",
            status: "COMPLETED",
            requiresHumanReview: true,
            isAiAssisted: true,
            createdAt: "2026-07-24T12:00:00Z",
          },
          message: "created",
          traceId: "agg-trace-002",
        },
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/ai-generation-records")
      .send({
        projectId: "proj-001",
        designOptionId: "opt-001",
        provider: "openai",
        model: "gpt-4",
        traceId: "trace-003",
        promptHash: "hash-001",
        status: "COMPLETED",
      })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-user-id", "user-001")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("id", "rec-003");
    expect(response.body.data).toHaveProperty("requiresHumanReview", true);
    expect(response.body.data).toHaveProperty("isAiAssisted", true);
  });

  it("应该成功转发 GET /api/v1/ai-generation-records/:id 单条查询", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          id: "rec-001",
          projectId: "proj-001",
          designOptionId: "opt-001",
          provider: "openai",
          model: "gpt-4",
          traceId: "trace-001",
          status: "COMPLETED",
          requiresHumanReview: true,
          isAiAssisted: true,
          createdAt: "2026-07-24T10:00:00Z",
        },
        message: "success",
        traceId: "agg-trace-003",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records/rec-001")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("id", "rec-001");
    expect(response.body.data).toHaveProperty("provider", "openai");
  });

  it("应该成功转发 PATCH /api/v1/ai-generation-records/:id/review 提交复核", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          id: "rec-001",
          status: "APPROVED",
          reviewedBy: "user-001",
          reviewedAt: "2026-07-24T13:00:00Z",
          reviewDecision: "APPROVED",
          reviewComment: "方案符合规范要求",
        },
        message: "success",
        traceId: "agg-trace-004",
      }),
    );

    const response = await request(app.getHttpServer())
      .patch("/api/v1/ai-generation-records/rec-001/review")
      .send({
        decision: "APPROVED",
        comment: "方案符合规范要求",
      })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-user-id", "user-001")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("status", "APPROVED");
    expect(response.body.data).toHaveProperty("reviewDecision", "APPROVED");
  });

  it("应该成功转发 GET /api/v1/ai-generation-records/by-trace/:traceId 按 traceId 反查", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          id: "rec-001",
          projectId: "proj-001",
          traceId: "trace-001",
          status: "COMPLETED",
          requiresHumanReview: true,
        },
        message: "success",
        traceId: "agg-trace-005",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records/by-trace/trace-001")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("traceId", "trace-001");
  });

  it("应该在下游返回 404 时正确透传错误响应", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 4040,
          errorCode: "AI_GENERATION_RECORD_NOT_FOUND",
          message: "AI 生成记录不存在",
          traceId: "agg-trace-006",
        },
        404,
      ),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records/not-found")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty(
      "errorCode",
      "AI_GENERATION_RECORD_NOT_FOUND",
    );
    expect(response.body).toHaveProperty("message", "AI 生成记录不存在");
  });

  it("应该正确转发 x-trace-id 头到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: { id: "rec-001", status: "COMPLETED" },
      }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records/rec-001")
      .set("Authorization", "Bearer test-token")
      .set("x-trace-id", "client-trace-001");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-trace-id", "client-trace-001");
  });

  it("应该正确转发 x-tenant-id 头到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: { id: "rec-001" },
      }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records/rec-001")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-tenant-001");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-tenant-id", "tenant-tenant-001");
  });

  it("应该正确转发 Authorization 头到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: { id: "rec-001" },
      }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records/rec-001")
      .set("Authorization", "Bearer jwt-token-xyz");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty(
      "authorization",
      "Bearer jwt-token-xyz",
    );
  });

  it("应该正确转发 idempotency-key 头到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 0,
          data: { id: "rec-003" },
        },
        201,
      ),
    );

    await request(app.getHttpServer())
      .post("/api/v1/ai-generation-records")
      .send({ projectId: "proj-001", status: "COMPLETED" })
      .set("Authorization", "Bearer test-token")
      .set("idempotency-key", "idem-key-001")
      .set("Content-Type", "application/json");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("idempotency-key", "idem-key-001");
  });

  it("应该在客户端未传 x-trace-id 时使用 request.traceId 回填", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: { id: "rec-001" },
      }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records/rec-001")
      .set("Authorization", "Bearer test-token");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-trace-id");
    expect(typeof callArgs.headers["x-trace-id"]).toBe("string");
    expect(callArgs.headers["x-trace-id"].length).toBeGreaterThan(0);
  });

  it("应该在 POST 请求时正确转发请求体到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 0,
          data: { id: "rec-003" },
        },
        201,
      ),
    );

    const requestBody = {
      projectId: "proj-001",
      designOptionId: "opt-001",
      provider: "openai",
      model: "gpt-4",
      traceId: "trace-003",
      status: "COMPLETED",
      promptHash: "hash-001",
    };

    await request(app.getHttpServer())
      .post("/api/v1/ai-generation-records")
      .send(requestBody)
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.body).toEqual(requestBody);
    expect(callArgs.method).toBe("POST");
  });

  it("应该在 GET 请求时 body 为 undefined", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: [],
      }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records")
      .set("Authorization", "Bearer test-token");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.body).toBeUndefined();
    expect(callArgs.method).toBe("GET");
  });

  it("应该正确规范化 query 参数", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: [],
      }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records")
      .query({ projectId: "proj-001", status: "COMPLETED" })
      .set("Authorization", "Bearer test-token");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.query).toHaveProperty("projectId", "proj-001");
    expect(callArgs.query).toHaveProperty("status", "COMPLETED");
  });

  it("应该在下游返回 500 时正确透传错误响应", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 5000,
          errorCode: "INTERNAL_ERROR",
          message: "Core Service 内部错误",
          traceId: "agg-trace-007",
        },
        500,
      ),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records/rec-001")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("errorCode", "INTERNAL_ERROR");
  });

  it("应该正确转发 x-user-id 头到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: { id: "rec-001" },
      }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records/rec-001")
      .set("Authorization", "Bearer test-token")
      .set("x-user-id", "user-001");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-user-id", "user-001");
  });

  it("应该正确转发 accept-language 头到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: { id: "rec-001" },
      }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/ai-generation-records/rec-001")
      .set("Authorization", "Bearer test-token")
      .set("accept-language", "zh-CN");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("accept-language", "zh-CN");
  });
});
