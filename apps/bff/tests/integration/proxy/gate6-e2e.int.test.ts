import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { Test, type TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../../../src/app.module";
import { ProxyService } from "../../../src/proxy/proxy.service";
import { CookieService } from "../../../src/proxy/auth/cookie.service";
import {
  ProxyResult,
  ProxyInterceptor,
} from "../../../src/interceptors/proxy.interceptor";

/**
 * Gate 6 全链路端到端验证
 *
 * 验证核心链路：
 * 1. 前端 → BFF 代理 → Java Core API 响应格式一致性
 * 2. ApiResponse<T> 成功响应（code === 0）透传
 * 3. ApiResponse 错误响应转换为 ApiErrorResponse 格式
 * 4. x-trace-id 跨服务传播
 * 5. 各域 API 端点可达性（Portfolio / IAM / CDE / TEVV）
 */
describe("Gate 6 — 全链路端到端验证", () => {
  let app: INestApplication;
  let mockForward: vi.Mock;
  let cookieServiceMock: {
    setRefreshTokenCookie: ReturnType<typeof vi.fn>;
    clearRefreshTokenCookie: ReturnType<typeof vi.fn>;
    getRefreshTokenFromCookie: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockForward = vi.fn();
    // CookieService mock：避免测试中依赖 ConfigService（isProduction 判定）
    cookieServiceMock = {
      setRefreshTokenCookie: vi.fn(),
      clearRefreshTokenCookie: vi.fn(),
      getRefreshTokenFromCookie: vi.fn().mockReturnValue(null),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProxyService)
      .useValue({ forward: mockForward })
      .overrideProvider(CookieService)
      .useValue(cookieServiceMock)
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

  function ok<T>(data: T, traceId = "e2e-trace"): ProxyResult {
    return {
      status: 200,
      data: { code: 0, data, message: "success", traceId },
      headers: {},
    };
  }

  function created<T>(data: T, traceId = "e2e-trace"): ProxyResult {
    return {
      status: 201,
      data: { code: 0, data, message: "created", traceId },
      headers: {},
    };
  }

  function error(
    code: number,
    message: string,
    status: number,
    traceId = "e2e-error-trace",
  ): ProxyResult {
    return {
      status,
      data: { code, data: null, message, traceId },
      headers: {},
    };
  }

  // ─── 链路 1：ApiResponse<T> 成功响应透传 ───

  it("Portfolio 域：GET /api/v1/projects 应透传 ApiResponse 格式", async () => {
    mockForward.mockResolvedValue(
      ok({ items: [{ id: "p1", name: "测试项目" }], total: 1 }),
    );

    const res = await request(app.getHttpServer())
      .get("/api/v1/projects")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.message).toBe("success");
    expect(res.body.traceId).toBe("e2e-trace");
  });

  it("IAM 域：POST /api/v1/auth/login 应透传 ApiResponse 格式", async () => {
    // mock 数据必须符合 loginResponseSchema（权威源：auth.schema.ts）
    const loginResponse = {
      principal: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        tenantId: "550e8400-e29b-41d4-a716-446655440002",
        email: "admin@example.com",
        displayName: "管理员",
        type: "user",
        status: "active",
        locale: "zh-CN",
        timezone: "Asia/Shanghai",
      },
      accessToken: "jwt-token-xyz",
      accessTokenExpiresIn: 3600,
      refreshTokenSet: true,
      refreshToken: "refresh-token-xyz",
      tenant: {
        id: "550e8400-e29b-41d4-a716-446655440002",
        name: "租户一",
        code: "TENANT001",
        region: "cn-east-1",
        language: "zh-CN",
      },
      roles: ["admin"],
      permissions: ["read:projects", "write:projects"],
    };
    mockForward.mockResolvedValue(created(loginResponse));

    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: "pass12345" });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveProperty("accessToken");
    // refresh token 应被 BFF 剥离，不暴露给浏览器
    expect(res.body.data).not.toHaveProperty("refreshToken");
  });

  it("CDE 域：GET /api/v1/documents 应透传 ApiResponse 格式", async () => {
    mockForward.mockResolvedValue(
      ok({ items: [{ id: "d1", name: "设计图.dwg" }], total: 1 }),
    );

    const res = await request(app.getHttpServer())
      .get("/api/v1/documents")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.items).toHaveLength(1);
  });

  it("TEVV 域：GET /api/v1/golden-datasets 应透传 ApiResponse 格式", async () => {
    mockForward.mockResolvedValue(
      ok([{ id: "ds-1", name: "金样数据集", status: "DRAFT" }]),
    );

    const res = await request(app.getHttpServer())
      .get("/api/v1/golden-datasets")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveLength(1);
  });

  // ─── 链路 2：ApiResponse 错误 → ApiErrorResponse 转换 ───

  it("404 错误应转换为 RFC 9457 Problem Details 格式", async () => {
    mockForward.mockResolvedValue(error(404, "资源不存在", 404));

    const res = await request(app.getHttpServer())
      .get("/api/v1/projects/not-found")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("errorCode", "404");
    expect(res.body).toHaveProperty("status", 404);
    expect(res.body).toHaveProperty("title", "Not Found");
    expect(res.body).toHaveProperty("detail", "资源不存在");
    expect(res.body).toHaveProperty("correlationId", "e2e-error-trace");
  });

  it("422 业务校验错误应转换为 Problem Details 格式", async () => {
    mockForward.mockResolvedValue(error(422, "建筑层数超出范围", 422));

    const res = await request(app.getHttpServer())
      .post("/api/v1/projects")
      .send({ name: "超高层", floors: 50 })
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty("errorCode", "422");
    expect(res.body).toHaveProperty("title", "Unprocessable Entity");
    expect(res.body).toHaveProperty("detail", "建筑层数超出范围");
  });

  it("500 服务端错误应标记 retryable", async () => {
    mockForward.mockResolvedValue(error(500, "内部错误", 500));

    const res = await request(app.getHttpServer())
      .get("/api/v1/internal-error")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("errorCode", "500");
    expect(res.body).toHaveProperty("retryable", true);
  });

  // ─── 链路 3：x-trace-id 跨服务传播 ───

  it("应将客户端传入的 x-trace-id 转发到下游", async () => {
    mockForward.mockResolvedValue(ok({ id: "p1" }));

    await request(app.getHttpServer())
      .get("/api/v1/projects/p1")
      .set("Authorization", "Bearer test-token")
      .set("x-trace-id", "client-trace-123");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-trace-id", "client-trace-123");
  });

  it("应在客户端未传 x-trace-id 时自动生成", async () => {
    mockForward.mockResolvedValue(ok({ id: "p1" }));

    await request(app.getHttpServer())
      .get("/api/v1/projects/p1")
      .set("Authorization", "Bearer test-token");

    const callArgs = mockForward.mock.calls[0][0];
    // request.traceId 由 RequestContext 中间件生成
    expect(callArgs.headers).toHaveProperty("x-trace-id");
  });

  // ─── 链路 4：租户隔离 Header ───

  it("应将 x-tenant-id 转发到下游服务", async () => {
    mockForward.mockResolvedValue(ok({ items: [] }));

    await request(app.getHttpServer())
      .get("/api/v1/projects")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty("x-tenant-id", "tenant-001");
  });
});
