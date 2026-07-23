import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { INestApplication, Controller, Get, Post, Req, Inject } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import appConfig from "../../../src/config/app.config";
import { ProxyService } from "../../../src/proxy/proxy.service";
import { ProxyResult, ProxyInterceptor } from "../../../src/interceptors/proxy.interceptor";
import { Request } from "express";

@Controller("v1/auth")
class TestAuthProxyController {
  constructor(@Inject(ProxyService) private readonly proxyService: ProxyService) {}

  @Post("login")
  async login(@Req() request: Request) {
    return this.proxyService.forward({
      method: "POST",
      path: "/v1/auth/login",
      body: request.body,
      headers: { authorization: request.headers.authorization },
    });
  }

  @Post("register")
  async register(@Req() request: Request) {
    return this.proxyService.forward({
      method: "POST",
      path: "/v1/auth/register",
      body: request.body,
      headers: { authorization: request.headers.authorization },
    });
  }

  @Get("me")
  async me(@Req() request: Request) {
    return this.proxyService.forward({
      method: "GET",
      path: "/v1/auth/me",
      headers: { authorization: request.headers.authorization, "x-trace-id": request.headers["x-trace-id"] },
    });
  }

  @Post("refresh")
  async refresh(@Req() request: Request) {
    return this.proxyService.forward({
      method: "POST",
      path: "/v1/auth/refresh",
      body: request.body,
      headers: { authorization: request.headers.authorization },
    });
  }

  @Post("logout")
  async logout(@Req() request: Request) {
    return this.proxyService.forward({
      method: "POST",
      path: "/v1/auth/logout",
      body: request.body,
      headers: { authorization: request.headers.authorization },
    });
  }

  @Post("change-password")
  async changePassword(@Req() request: Request) {
    return this.proxyService.forward({
      method: "POST",
      path: "/v1/auth/change-password",
      body: request.body,
      headers: { authorization: request.headers.authorization },
    });
  }
}

describe("Auth 代理集成测试", () => {
  let app: INestApplication;
  let mockForward: vi.Mock;

  beforeEach(async () => {
    mockForward = vi.fn();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [appConfig],
          cache: true,
        }),
      ],
      controllers: [TestAuthProxyController],
      providers: [
        {
          provide: ProxyService,
          useValue: { forward: mockForward },
        },
      ],
    }).compile();

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

  it("应该成功转发登录请求到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        user: { id: "u1", username: "testuser", role: "ARCHITECT" },
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username: "testuser", password: "password123" });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBe("test-access-token");
    expect(mockForward).toHaveBeenCalled();
  });

  it("应该成功转发注册请求到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        { id: "u2", username: "newuser", email: "new@test.com" },
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        username: "newuser",
        email: "new@test.com",
        password: "Password123!",
      });

    expect(response.status).toBe(201);
    expect(response.body.username).toBe("newuser");
  });

  it("应该成功转发获取当前用户请求到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({ id: "u1", username: "testuser" }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body.username).toBe("testuser");
  });

  it("应该验证 traceId 和 Authorization 头被正确传递", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({ id: "u1", username: "testuser" }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer test-token")
      .set("x-trace-id", "trace-123");

    expect(mockForward).toHaveBeenCalled();
    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.method).toBe("GET");
    expect(callArgs.headers.authorization).toBe("Bearer test-token");
    expect(callArgs.headers["x-trace-id"]).toBe("trace-123");
  });

  it("应该在下游返回 401 时透传错误状态码", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({ errorCode: "UNAUTHORIZED", message: "未授权" }, 401),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
  });

  it("应该在下游返回 500 时透传错误状态码", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({ errorCode: "INTERNAL_ERROR", message: "服务器内部错误" }, 500),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ username: "testuser", password: "password123" });

    expect(response.status).toBe(500);
  });

  it("应该成功转发刷新 token 请求到 Core Service", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBe("new-access-token");
    expect(mockForward).toHaveBeenCalled();
  });

  it("应该成功转发登出请求到 Core Service", async () => {
    mockForward.mockResolvedValue(buildProxyResult({ success: true }));

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockForward).toHaveBeenCalled();
  });

  it("应该成功转发修改密码请求到 Core Service", async () => {
    mockForward.mockResolvedValue(buildProxyResult({ success: true }));

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/change-password")
      .send({ oldPassword: "old", newPassword: "new" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockForward).toHaveBeenCalled();
  });
});
