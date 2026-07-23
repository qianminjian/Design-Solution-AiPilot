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
 * 工作流代理集成测试
 *
 * 覆盖 WorkflowProxyController 端点：
 * - GET  /api/v1/workflow/stages?projectId=...
 * - POST /api/v1/workflow/stages/:stageId:transition
 * - GET  /api/v1/workflow/gates?stageId=...
 * - POST /api/v1/workflow/gates/:gateId:decide
 * - GET  /api/v1/workflow/baselines?projectId=...
 * - GET  /api/v1/workflow/baselines/:baselineId
 * - POST /api/v1/workflow/baselines/:baselineId:freeze
 *
 * 验证内容：
 * 1. 请求被正确转发到 ProxyService.forward
 * 2. 下游返回的 ApiResponse 透传给前端
 * 3. 转发头（Authorization / x-tenant-id / x-user-id / x-trace-id）正确传递
 * 4. 自定义动作路径（:transition / :decide / :freeze）正确匹配
 */
describe("工作流代理集成测试", () => {
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

  it("应该成功转发 GET /api/v1/workflow/stages 列出阶段", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: [
          {
            id: "stage-1",
            stageCode: "STG-P0",
            stageName: "前期策划",
            stageOrder: 0,
            status: "ACTIVE",
          },
          {
            id: "stage-2",
            stageCode: "STG-P1",
            stageName: "概念设计",
            stageOrder: 1,
            status: "NOT_STARTED",
          },
        ],
        message: "success",
        traceId: "wf-trace-001",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/workflow/stages")
      .query({ projectId: "proj-001" })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-trace-id", "wf-trace-inbound");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("code", 0);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toHaveProperty("stageCode", "STG-P0");
    expect(response.body.data[1]).toHaveProperty("status", "NOT_STARTED");

    // 验证 forward 调用参数：路径与方法
    expect(mockForward).toHaveBeenCalledTimes(1);
    const callArgs = mockForward.mock.calls[0][0] as {
      method: string;
      path: string;
    };
    expect(callArgs.method).toBe("GET");
    expect(callArgs.path).toContain("/api/v1/workflow/stages");
    expect(callArgs.path).toContain("projectId=proj-001");
  });

  it("应该成功转发 POST /api/v1/workflow/stages/:stageId:transition 阶段流转", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          id: "stage-1",
          status: "ACTIVE",
          startedAt: "2026-07-23T10:00:00Z",
        },
        message: "success",
        traceId: "wf-trace-002",
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/workflow/stages/stage-1:transition")
      .send({ targetStatus: "ACTIVE", comment: "启动 P0 阶段" })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-user-id", "user-001")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("status", "ACTIVE");
    expect(response.body.data).toHaveProperty("startedAt");

    // 验证路径正确转发（含 :transition 自定义动作）
    expect(mockForward).toHaveBeenCalledTimes(1);
    const callArgs = mockForward.mock.calls[0][0] as {
      method: string;
      path: string;
      body: unknown;
    };
    expect(callArgs.method).toBe("POST");
    expect(callArgs.path).toContain(
      "/api/v1/workflow/stages/stage-1:transition",
    );
    expect(callArgs.body).toMatchObject({
      targetStatus: "ACTIVE",
      comment: "启动 P0 阶段",
    });
  });

  it("应该成功转发 GET /api/v1/workflow/gates 列出门控决策", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: [
          {
            id: "gate-1",
            gateCode: "GATE-P0",
            status: "PENDING",
            decision: null,
          },
        ],
        message: "success",
        traceId: "wf-trace-003",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/workflow/gates")
      .query({ stageId: "stage-1" })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toHaveProperty("gateCode", "GATE-P0");
    expect(response.body.data[0]).toHaveProperty("status", "PENDING");

    expect(mockForward).toHaveBeenCalledTimes(1);
    const callArgs = mockForward.mock.calls[0][0] as { path: string };
    expect(callArgs.path).toContain("/api/v1/workflow/gates");
    expect(callArgs.path).toContain("stageId=stage-1");
  });

  it("应该成功转发 POST /api/v1/workflow/gates/:gateId:decide 门控决策", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          id: "gate-1",
          decision: "APPROVED",
          status: "DECIDED",
          decidedAt: "2026-07-23T11:00:00Z",
        },
        message: "success",
        traceId: "wf-trace-004",
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/workflow/gates/gate-1:decide")
      .send({ decision: "APPROVED", comment: "通过" })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-user-id", "user-001")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("decision", "APPROVED");
    expect(response.body.data).toHaveProperty("status", "DECIDED");
    expect(response.body.data).toHaveProperty("decidedAt");

    expect(mockForward).toHaveBeenCalledTimes(1);
    const callArgs = mockForward.mock.calls[0][0] as {
      method: string;
      path: string;
    };
    expect(callArgs.method).toBe("POST");
    expect(callArgs.path).toContain("/api/v1/workflow/gates/gate-1:decide");
  });

  it("应该成功转发 GET /api/v1/workflow/baselines 列出项目基线", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: [
          {
            id: "bl-2",
            revisionNo: 2,
            status: "DRAFT",
          },
          {
            id: "bl-1",
            revisionNo: 1,
            status: "PUBLISHED",
          },
        ],
        message: "success",
        traceId: "wf-trace-005",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/workflow/baselines")
      .query({ projectId: "proj-001" })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toHaveProperty("revisionNo", 2);
    expect(response.body.data[1]).toHaveProperty("status", "PUBLISHED");

    expect(mockForward).toHaveBeenCalledTimes(1);
    const callArgs = mockForward.mock.calls[0][0] as { path: string };
    expect(callArgs.path).toContain("/api/v1/workflow/baselines");
    expect(callArgs.path).toContain("projectId=proj-001");
  });

  it("应该成功转发 GET /api/v1/workflow/baselines/:baselineId 获取基线详情", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          id: "bl-1",
          revisionNo: 1,
          status: "DRAFT",
          createdAt: "2026-07-23T09:00:00Z",
        },
        message: "success",
        traceId: "wf-trace-006",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/workflow/baselines/bl-1")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("id", "bl-1");
    expect(response.body.data).toHaveProperty("status", "DRAFT");

    expect(mockForward).toHaveBeenCalledTimes(1);
    const callArgs = mockForward.mock.calls[0][0] as { path: string };
    expect(callArgs.path).toContain("/api/v1/workflow/baselines/bl-1");
  });

  it("应该成功转发 POST /api/v1/workflow/baselines/:baselineId:freeze 冻结基线", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          id: "bl-1",
          revisionNo: 1,
          status: "PUBLISHED",
          frozenAt: "2026-07-23T12:00:00Z",
        },
        message: "success",
        traceId: "wf-trace-007",
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/workflow/baselines/bl-1:freeze")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-user-id", "user-001");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("status", "PUBLISHED");
    expect(response.body.data).toHaveProperty("frozenAt");

    expect(mockForward).toHaveBeenCalledTimes(1);
    const callArgs = mockForward.mock.calls[0][0] as {
      method: string;
      path: string;
    };
    expect(callArgs.method).toBe("POST");
    expect(callArgs.path).toContain("/api/v1/workflow/baselines/bl-1:freeze");
  });

  it("应该正确传递 x-trace-id 头到下游请求", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: { id: "stage-1", status: "ACTIVE" },
        message: "success",
        traceId: "wf-trace-008",
      }),
    );

    await request(app.getHttpServer())
      .get("/api/v1/workflow/stages")
      .query({ projectId: "proj-001" })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-trace-id", "inbound-trace-xyz");

    expect(mockForward).toHaveBeenCalledTimes(1);
    const callArgs = mockForward.mock.calls[0][0] as {
      headers: Record<string, string>;
    };
    expect(callArgs.headers["x-trace-id"]).toBe("inbound-trace-xyz");
    expect(callArgs.headers["authorization"]).toBe("Bearer test-token");
    expect(callArgs.headers["x-tenant-id"]).toBe("tenant-001");
  });

  it("应该将下游错误响应透传给前端（422 + INVALID_STAGE_TRANSITION）", async () => {
    // Java ApiResponse 错误格式：包含 code + data + message + traceId
    // ProxyInterceptor 仅在 isApiResponse(result.data) 为 true 时触发转换
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 4230,
          data: null,
          message: "INVALID_STAGE_TRANSITION",
          traceId: "wf-trace-err",
        },
        422,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/workflow/stages/stage-1:transition")
      .send({ targetStatus: "APPROVED", comment: "非法跳转" })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(422);
    // ProxyInterceptor 将 ApiResponse 错误体转换为 ApiErrorResponse（RFC 9457）
    // code 字段保留为数字，errorCode 为其字符串形式
    expect(response.body).toHaveProperty("code", 4230);
    expect(response.body).toHaveProperty("errorCode", "4230");
    expect(response.body).toHaveProperty("status", 422);
    expect(response.body).toHaveProperty("title", "Unprocessable Entity");
    expect(response.body).toHaveProperty("detail", "INVALID_STAGE_TRANSITION");
    expect(response.body).toHaveProperty("correlationId", "wf-trace-err");
  });
});
