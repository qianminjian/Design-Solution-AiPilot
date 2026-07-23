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

describe("Core Service 通配符代理集成测试", () => {
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

  it("应该成功转发 GET /api/v1/projects 请求到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          items: [
            { id: "p1", name: "项目A" },
            { id: "p2", name: "项目B" },
          ],
          total: 2,
          page: 1,
          pageSize: 10,
          hasMore: false,
        },
        message: "success",
        traceId: "trace-001",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/projects")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("code", 0);
    expect(response.body.data).toHaveProperty("items");
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items[0]).toHaveProperty("id", "p1");
    expect(response.body.data.items[1]).toHaveProperty("id", "p2");
  });

  it("应该成功转发 GET /api/v1/projects/:id 请求到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: { id: "p1", name: "测试项目", status: "ACTIVE" },
        message: "success",
        traceId: "trace-002",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/projects/p1")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("code", 0);
    expect(response.body.data).toHaveProperty("id", "p1");
    expect(response.body.data).toHaveProperty("name", "测试项目");
    expect(response.body.data).toHaveProperty("status", "ACTIVE");
  });

  it("应该成功转发 POST /api/v1/projects 请求到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 0,
          data: { id: "p3", name: "新项目", status: "DRAFT" },
          message: "created",
          traceId: "trace-003",
        },
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/projects")
      .send({ name: "新项目", description: "测试项目描述" })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("code", 0);
    expect(response.body.data).toHaveProperty("id", "p3");
    expect(response.body.data).toHaveProperty("name", "新项目");
    expect(response.body.data).toHaveProperty("status", "DRAFT");
  });

  it("应该成功转发 GET /api/v1/principals 请求到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: { items: [{ id: "pr1", name: "主创建筑师" }], total: 1 },
        message: "success",
        traceId: "trace-004",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/principals")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("code", 0);
    expect(response.body.data).toHaveProperty("items");
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toHaveProperty("id", "pr1");
  });

  it("应该在下游返回 404 时将 ApiResponse 错误转换为 ApiErrorResponse 格式", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 404,
          data: null,
          message: "项目不存在",
          traceId: "error-trace-333",
        },
        404,
      ),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/projects/not-found")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errorCode", "404");
    expect(response.body).toHaveProperty("status", 404);
    expect(response.body).toHaveProperty("title", "Not Found");
    expect(response.body).toHaveProperty("detail", "项目不存在");
    expect(response.body).toHaveProperty("correlationId", "error-trace-333");
  });

  it("应该在下游返回 500 时将 ApiResponse 错误转换为 ApiErrorResponse 格式", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 500,
          data: null,
          message: "服务内部错误",
          traceId: "error-trace-500",
        },
        500,
      ),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/internal-error")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("errorCode", "500");
    expect(response.body).toHaveProperty("status", 500);
    expect(response.body).toHaveProperty("title", "Internal Server Error");
    expect(response.body).toHaveProperty("detail", "服务内部错误");
    expect(response.body).toHaveProperty("retryable", true);
  });

  it("应该正确转发查询参数到下游服务", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: { items: [{ id: "p1", name: "项目A" }], total: 1 },
        message: "success",
        traceId: "trace-005",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/projects")
      .query({ page: "1", pageSize: "10" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("code", 0);
    expect(response.body.data).toHaveProperty("items");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.query).toEqual({ page: "1", pageSize: "10" });
  });
});
