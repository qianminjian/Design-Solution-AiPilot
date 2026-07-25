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

describe("Design 设计选项代理集成测试", () => {
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

  it("应该成功转发 GET /api/v1/design-options 列表查询", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          items: [
            {
              id: "opt-1",
              title: "方案 A-围合式中庭",
              status: "DRAFT",
              discipline: "ARCHITECTURE",
            },
            {
              id: "opt-2",
              title: "方案 B-线性布局",
              status: "CANDIDATE",
              discipline: "ARCHITECTURE",
            },
          ],
          total: 2,
          page: 1,
          pageSize: 20,
          hasMore: false,
        },
        message: "success",
        traceId: "design-trace-001",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/design-options")
      .query({ projectId: "proj-1" })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("code", 0);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items[0]).toHaveProperty("id", "opt-1");
    expect(response.body.data.total).toBe(2);

    // 验证路径与 query 透传
    expect(mockForward).toHaveBeenCalledTimes(1);
    const callArgs = mockForward.mock.calls[0][0] as {
      method: string;
      path: string;
      query: Record<string, string>;
    };
    expect(callArgs.method).toBe("GET");
    expect(callArgs.path).toContain("/api/v1/design-options");
    expect(callArgs.query.projectId).toBe("proj-1");
  });

  it("应该成功转发 POST /api/v1/design-options 创建设计选项", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 0,
          data: {
            id: "550e8400-e29b-41d4-a716-446655440003",
            tenantId: "550e8400-e29b-41d4-a716-446655440001",
            projectId: "550e8400-e29b-41d4-a716-446655440002",
            title: "方案 C-庭院式",
            description: "围绕内部庭院组织功能",
            status: "DRAFT",
            discipline: "ARCHITECTURE",
            metadata: {},
            createdBy: "550e8400-e29b-41d4-a716-446655440004",
            createdAt: "2026-07-25T10:00:00.000Z",
            updatedAt: "2026-07-25T10:00:00.000Z",
            rowVersion: 0,
          },
          message: "created",
          traceId: "design-trace-002",
        },
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/design-options")
      .send({
        projectId: "550e8400-e29b-41d4-a716-446655440002",
        title: "方案 C-庭院式",
        description: "围绕内部庭院组织功能",
        discipline: "ARCHITECTURE",
      })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-user-id", "user-001")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("code", 0);
    expect(response.body.data).toHaveProperty(
      "id",
      "550e8400-e29b-41d4-a716-446655440003",
    );
    expect(response.body.data).toHaveProperty("status", "DRAFT");
  });

  it("POST /api/v1/design-options 响应缺失 status 应返回 502（契约验证阻断）", async () => {
    // 模拟 Core Service 漂移：缺失 status 字段
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 0,
          data: {
            id: "550e8400-e29b-41d4-a716-446655440003",
            tenantId: "550e8400-e29b-41d4-a716-446655440001",
            projectId: "550e8400-e29b-41d4-a716-446655440002",
            title: "方案 C-庭院式",
            // 缺失 status 字段
            discipline: "ARCHITECTURE",
            metadata: {},
            createdBy: "550e8400-e29b-41d4-a716-446655440004",
            createdAt: "2026-07-25T10:00:00.000Z",
            updatedAt: "2026-07-25T10:00:00.000Z",
            rowVersion: 0,
          },
          message: "created",
          traceId: "design-trace-002",
        },
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/design-options")
      .send({
        projectId: "550e8400-e29b-41d4-a716-446655440002",
        title: "方案 C-庭院式",
        discipline: "ARCHITECTURE",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(502);
    expect(response.body).toHaveProperty(
      "errorCode",
      "CONTRACT_VALIDATION_FAILED",
    );
  });

  it("应该成功转发 GET /api/v1/design-options/:id 查询详情", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          id: "550e8400-e29b-41d4-a716-446655440010",
          tenantId: "550e8400-e29b-41d4-a716-446655440001",
          projectId: "550e8400-e29b-41d4-a716-446655440002",
          title: "方案 A-围合式中庭",
          description: "围绕中央采光中庭布置核心筒",
          status: "CANDIDATE",
          discipline: "ARCHITECTURE",
          metadata: {},
          createdBy: "550e8400-e29b-41d4-a716-446655440004",
          createdAt: "2026-07-23T10:00:00Z",
          updatedAt: "2026-07-23T10:30:00Z",
          rowVersion: 2,
        },
        message: "success",
        traceId: "design-trace-003",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/design-options/550e8400-e29b-41d4-a716-446655440010")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("title", "方案 A-围合式中庭");
    expect(response.body.data).toHaveProperty("status", "CANDIDATE");
  });

  it("应该成功转发 POST /api/v1/design-options/:id/feedback 提交反馈", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 0,
          data: {
            id: "fb-1",
            optionId: "opt-1",
            comment: "中庭采光效果佳",
            rating: 4,
            authorId: "user-001",
            createdAt: "2026-07-23T11:00:00Z",
          },
          message: "created",
          traceId: "design-trace-004",
        },
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/design-options/opt-1/feedback")
      .send({
        comment: "中庭采光效果佳",
        rating: 4,
      })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-user-id", "user-001")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("comment", "中庭采光效果佳");
    expect(response.body.data).toHaveProperty("rating", 4);
  });

  it("应该成功转发 GET /api/v1/design-options/:id/feedback 反馈列表", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: [
          {
            id: "fb-1",
            comment: "整体布局合理",
            rating: 4,
            authorId: "user-001",
            createdAt: "2026-07-23T11:00:00Z",
          },
          {
            id: "fb-2",
            comment: "疏散宽度需复核",
            rating: 2,
            authorId: "user-002",
            createdAt: "2026-07-23T12:00:00Z",
          },
        ],
        message: "success",
        traceId: "design-trace-005",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/design-options/opt-1/feedback")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toHaveProperty("comment");
  });

  it("应该将下游 404 错误响应透传给前端（设计选项不存在）", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 404,
          data: null,
          message: "DESIGN_OPTION_NOT_FOUND",
          traceId: "design-trace-err",
        },
        404,
      ),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/design-options/nonexistent")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("code", 404);
    expect(response.body).toHaveProperty("errorCode", "404");
    expect(response.body).toHaveProperty("status", 404);
    expect(response.body).toHaveProperty("correlationId", "design-trace-err");
  });

  it("应该透传 x-trace-id 头用于全链路追踪", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 0,
          data: [],
          message: "success",
          traceId: "trace-from-downstream",
        },
        200,
        { "x-trace-id": "trace-from-downstream" },
      ),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/design-options")
      .query({ projectId: "proj-1" })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-trace-id", "upstream-trace-id");

    expect(response.status).toBe(200);
    expect(response.headers["x-trace-id"]).toBeDefined();
  });
});
