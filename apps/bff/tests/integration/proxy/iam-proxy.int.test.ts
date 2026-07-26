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
 * IAM 域代理集成测试
 *
 * 覆盖 principals/organizations/memberships/role-bindings/grants 五类资源的代理转发与
 * schema 严格验证场景：
 *  - 单实体创建/详情：schema 严格验证通过
 *  - schema 严格验证失败：返回 502 BadGateway
 *  - 列表查询（数组业务数据）：跳过严格验证，直接透传
 *  - 下游错误响应透传
 *  - 关键 header 与 query 参数透传
 */
describe("IAM 域代理集成测试", () => {
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

  /** 构造符合 ApiResponse<T> 包装格式的成功响应 */
  function buildApiResponse<T>(data: T, traceId = "trace-iam-001") {
    return {
      code: 0,
      data,
      message: "success",
      traceId,
    };
  }

  // ── Principal 主体 ──

  it("应该成功转发 POST /api/v1/principals 创建主体（schema 严格验证通过）", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          id: "11111111-1111-4111-8111-111111111111",
          tenantId: "22222222-2222-4222-8222-222222222222",
          type: "user",
          email: "architect@example.com",
          displayName: "张工",
          status: "active",
          locale: "zh-CN",
          timezone: "Asia/Shanghai",
          classification: "internal",
          externalId: null,
          lastLoginAt: null,
          createdAt: "2026-07-26T10:00:00Z",
          updatedAt: "2026-07-26T10:00:00Z",
          rowVersion: 1,
        }),
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/principals")
      .send({
        email: "architect@example.com",
        displayName: "张工",
        password: "secure-password-123",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(201);
    expect(response.body.code).toBe(0);
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data).toHaveProperty("email", "architect@example.com");
    expect(response.body.data).toHaveProperty("displayName", "张工");
  });

  it("应该成功转发 GET /api/v1/principals/:id 获取主体详情", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          id: "11111111-1111-4111-8111-111111111111",
          tenantId: "22222222-2222-4222-8222-222222222222",
          type: "user",
          email: "architect@example.com",
          displayName: "张工",
          status: "active",
          locale: "zh-CN",
          timezone: "Asia/Shanghai",
          classification: "internal",
          externalId: null,
          lastLoginAt: "2026-07-26T08:00:00Z",
          createdAt: "2026-07-26T10:00:00Z",
          updatedAt: "2026-07-26T10:00:00Z",
          rowVersion: 5,
        }),
      ),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/principals/11111111-1111-4111-8111-111111111111")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty(
      "id",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(response.body.data).toHaveProperty("type", "user");
  });

  it("应该在 POST /api/v1/principals 响应 schema 验证失败时返回 502", async () => {
    // 缺失 email、displayName 等必填字段
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          id: "11111111-1111-4111-8111-111111111111",
          tenantId: "22222222-2222-4222-8222-222222222222",
          // 缺失 type、email、displayName、status、locale、timezone、classification 等
          externalId: null,
          lastLoginAt: null,
          createdAt: "2026-07-26T10:00:00Z",
          updatedAt: "2026-07-26T10:00:00Z",
          rowVersion: 1,
        }),
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/principals")
      .send({
        email: "architect@example.com",
        displayName: "张工",
        password: "secure-password-123",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(502);
    expect(response.body).toHaveProperty(
      "errorCode",
      "CONTRACT_VALIDATION_FAILED",
    );
  });

  it("应该成功转发 GET /api/v1/principals 列表查询（跳过严格验证）", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              tenantId: "22222222-2222-4222-8222-222222222222",
              type: "user",
              email: "a@example.com",
              displayName: "A",
              status: "active",
              locale: "zh-CN",
              timezone: "Asia/Shanghai",
              classification: "internal",
              externalId: null,
              lastLoginAt: null,
              createdAt: "2026-07-26T10:00:00Z",
              updatedAt: "2026-07-26T10:00:00Z",
              rowVersion: 1,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
          hasMore: false,
        }),
      ),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/principals")
      .query({ page: "1", pageSize: "10" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
  });

  // ── Organization 组织 ──

  it("应该成功转发 POST /api/v1/organizations 创建组织", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          id: "33333333-3333-4333-8333-333333333333",
          tenantId: "22222222-2222-4222-8222-222222222222",
          parentId: null,
          name: "建筑设计院",
          type: "enterprise",
          status: "active",
          classification: "internal",
          metadata: {},
          createdAt: "2026-07-26T10:00:00Z",
          updatedAt: "2026-07-26T10:00:00Z",
          rowVersion: 1,
        }),
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .send({ name: "建筑设计院", type: "enterprise" })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("name", "建筑设计院");
    expect(response.body.data).toHaveProperty("type", "enterprise");
  });

  it("应该成功转发 GET /api/v1/organizations/:id 获取组织详情", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          id: "33333333-3333-4333-8333-333333333333",
          tenantId: "22222222-2222-4222-8222-222222222222",
          parentId: null,
          name: "建筑设计院",
          type: "enterprise",
          status: "active",
          classification: "internal",
          metadata: {},
          createdAt: "2026-07-26T10:00:00Z",
          updatedAt: "2026-07-26T10:00:00Z",
          rowVersion: 1,
        }),
      ),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/organizations/33333333-3333-4333-8333-333333333333")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("name", "建筑设计院");
  });

  // ── Membership 成员关系 ──

  it("应该成功转发 POST /api/v1/memberships 创建成员关系", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          id: "44444444-4444-4444-8444-444444444444",
          tenantId: "22222222-2222-4222-8222-222222222222",
          principalId: "11111111-1111-4111-8111-111111111111",
          organizationId: "33333333-3333-4333-8333-333333333333",
          role: "architect",
          status: "active",
          joinedAt: "2026-07-26T10:00:00Z",
          effectiveFrom: "2026-07-26T10:00:00Z",
          effectiveTo: null,
          createdAt: "2026-07-26T10:00:00Z",
          updatedAt: "2026-07-26T10:00:00Z",
          rowVersion: 1,
        }),
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/memberships")
      .send({
        principalId: "11111111-1111-4111-8111-111111111111",
        organizationId: "33333333-3333-4333-8333-333333333333",
        role: "architect",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("role", "architect");
    expect(response.body.data).toHaveProperty("status", "active");
  });

  it("应该在 POST /api/v1/memberships 响应 schema 验证失败时返回 502", async () => {
    // 缺失 principalId、organizationId、role 等必填字段
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          id: "44444444-4444-4444-8444-444444444444",
          tenantId: "22222222-2222-4222-8222-222222222222",
          status: "active",
          joinedAt: "2026-07-26T10:00:00Z",
          createdAt: "2026-07-26T10:00:00Z",
          updatedAt: "2026-07-26T10:00:00Z",
          rowVersion: 1,
        }),
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/memberships")
      .send({
        principalId: "11111111-1111-4111-8111-111111111111",
        organizationId: "33333333-3333-4333-8333-333333333333",
        role: "architect",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(502);
    expect(response.body).toHaveProperty(
      "errorCode",
      "CONTRACT_VALIDATION_FAILED",
    );
  });

  // ── RoleBinding 角色绑定 ──

  it("应该成功转发 POST /api/v1/role-bindings 创建角色绑定", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          id: "55555555-5555-4555-8555-555555555555",
          tenantId: "22222222-2222-4222-8222-222222222222",
          principalId: "11111111-1111-4111-8111-111111111111",
          roleCode: "architect.lead",
          scopeType: "organization",
          scopeId: "33333333-3333-4333-8333-333333333333",
          status: "active",
          grantedAt: "2026-07-26T10:00:00Z",
          grantedBy: "99999999-9999-4999-8999-999999999999",
          effectiveFrom: "2026-07-26T10:00:00Z",
          effectiveTo: null,
          createdAt: "2026-07-26T10:00:00Z",
          updatedAt: "2026-07-26T10:00:00Z",
          rowVersion: 1,
        }),
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/role-bindings")
      .send({
        principalId: "11111111-1111-4111-8111-111111111111",
        roleCode: "architect.lead",
        scopeType: "organization",
        scopeId: "33333333-3333-4333-8333-333333333333",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("roleCode", "architect.lead");
    expect(response.body.data).toHaveProperty("scopeType", "organization");
  });

  // ── AccessGrant 显式授权 ──

  it("应该成功转发 POST /api/v1/grants 创建显式授权", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          id: "66666666-6666-4666-8666-666666666666",
          tenantId: "22222222-2222-4222-8222-222222222222",
          principalId: "11111111-1111-4111-8111-111111111111",
          permission: "document:approve",
          resourceType: "document",
          resourceId: "77777777-7777-4777-8777-777777777777",
          effect: "allow",
          status: "active",
          grantedAt: "2026-07-26T10:00:00Z",
          grantedBy: "99999999-9999-4999-8999-999999999999",
          effectiveFrom: "2026-07-26T10:00:00Z",
          effectiveTo: null,
          createdAt: "2026-07-26T10:00:00Z",
          updatedAt: "2026-07-26T10:00:00Z",
          rowVersion: 1,
        }),
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/grants")
      .send({
        principalId: "11111111-1111-4111-8111-111111111111",
        permission: "document:approve",
        resourceType: "document",
        resourceId: "77777777-7777-4777-8777-777777777777",
        effect: "allow",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("permission", "document:approve");
    expect(response.body.data).toHaveProperty("effect", "allow");
  });

  // ── 错误透传 ──

  it("应该在下游返回 404 主体不存在时正确透传", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 404,
          data: null,
          message: "主体不存在",
          traceId: "error-trace-404",
        },
        404,
      ),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/principals/not-found-id")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errorCode", "404");
    expect(response.body).toHaveProperty("detail", "主体不存在");
  });

  it("应该在下游返回 500 时正确透传", async () => {
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
      .get("/api/v1/principals/11111111-1111-4111-8111-111111111111")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("retryable", true);
  });

  // ── Header 与 query 透传 ──

  it("应该正确转发 Authorization、x-tenant-id、x-trace-id 等关键 header", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          id: "33333333-3333-4333-8333-333333333333",
          tenantId: "22222222-2222-4222-8222-222222222222",
          parentId: null,
          name: "建筑设计院",
          type: "enterprise",
          status: "active",
          classification: "internal",
          metadata: {},
          createdAt: "2026-07-26T10:00:00Z",
          updatedAt: "2026-07-26T10:00:00Z",
          rowVersion: 1,
        }),
      ),
    );

    await request(app.getHttpServer())
      .get("/api/v1/organizations/33333333-3333-4333-8333-333333333333")
      .set("Authorization", "Bearer custom-token-789")
      .set("x-tenant-id", "22222222-2222-4222-8222-222222222222")
      .set("x-trace-id", "iam-trace-001")
      .set("accept-language", "zh-CN");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.headers).toHaveProperty(
      "authorization",
      "Bearer custom-token-789",
    );
    expect(callArgs.headers).toHaveProperty(
      "x-tenant-id",
      "22222222-2222-4222-8222-222222222222",
    );
    expect(callArgs.headers).toHaveProperty("x-trace-id", "iam-trace-001");
    expect(callArgs.headers).toHaveProperty("accept-language", "zh-CN");
    expect(callArgs.path).toBe(
      "/api/v1/organizations/33333333-3333-4333-8333-333333333333",
    );
    expect(callArgs.method).toBe("GET");
  });

  it("应该正确转发 query 参数到下游", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          items: [],
          total: 0,
          page: 1,
          pageSize: 10,
          hasMore: false,
        }),
      ),
    );

    await request(app.getHttpServer())
      .get("/api/v1/memberships")
      .query({ page: "1", pageSize: "20", role: "architect", status: "active" })
      .set("Authorization", "Bearer test-token");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.query).toEqual({
      page: "1",
      pageSize: "20",
      role: "architect",
      status: "active",
    });
  });

  it("应该正确转发 POST 请求体到下游服务", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        buildApiResponse({
          id: "11111111-1111-4111-8111-111111111111",
          tenantId: "22222222-2222-4222-8222-222222222222",
          type: "user",
          email: "new@example.com",
          displayName: "新用户",
          status: "pending",
          locale: "zh-CN",
          timezone: "Asia/Shanghai",
          classification: "internal",
          externalId: null,
          lastLoginAt: null,
          createdAt: "2026-07-26T10:00:00Z",
          updatedAt: "2026-07-26T10:00:00Z",
          rowVersion: 1,
        }),
        201,
      ),
    );

    await request(app.getHttpServer())
      .post("/api/v1/principals")
      .send({
        email: "new@example.com",
        displayName: "新用户",
        password: "very-secure-pwd",
        type: "user",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    const callArgs = mockForward.mock.calls[0][0];
    expect(callArgs.method).toBe("POST");
    expect(callArgs.body).toHaveProperty("email", "new@example.com");
    expect(callArgs.body).toHaveProperty("displayName", "新用户");
    expect(callArgs.body).toHaveProperty("type", "user");
  });
});
