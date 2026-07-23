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

describe("TEVV 金样数据集代理集成测试", () => {
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

  it("应该成功转发 GET /api/v1/golden-datasets 请求", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: [
          {
            id: "ds-1",
            name: "办公楼金样 v1",
            category: "ARCHITECTURE",
            status: "DRAFT",
          },
          {
            id: "ds-2",
            name: "结构验证集",
            category: "STRUCTURE",
            status: "FROZEN",
          },
        ],
        message: "success",
        traceId: "tevv-trace-001",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/golden-datasets")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("code", 0);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toHaveProperty("id", "ds-1");
    expect(response.body.data[1]).toHaveProperty("status", "FROZEN");
  });

  it("应该成功转发 POST /api/v1/golden-datasets 创建数据集", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 0,
          data: {
            id: "ds-3",
            name: "新建数据集",
            category: "MEP",
            status: "DRAFT",
          },
          message: "created",
          traceId: "tevv-trace-002",
        },
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/golden-datasets")
      .send({
        name: "新建数据集",
        category: "MEP",
        buildingType: "OFFICE_MEDIUM",
        storageKey: "golden/test",
      })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-user-id", "user-001")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("code", 0);
    expect(response.body.data).toHaveProperty("id", "ds-3");
    expect(response.body.data).toHaveProperty("status", "DRAFT");
  });

  it("应该成功转发 POST /api/v1/golden-datasets/:id/freeze 冻结数据集", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          id: "ds-1",
          name: "办公楼金样 v1",
          status: "FROZEN",
          frozenAt: "2026-07-23T09:00:00Z",
        },
        message: "success",
        traceId: "tevv-trace-003",
      }),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/golden-datasets/ds-1/freeze")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-user-id", "user-001");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("status", "FROZEN");
    expect(response.body.data).toHaveProperty("frozenAt");
  });
});

describe("TEVV 验证项代理集成测试", () => {
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

  it("应该成功转发 GET /api/v1/verification-items?datasetId=xxx 请求", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: [
          {
            id: "vi-1",
            gateCode: "GATE-P1",
            verificationType: "MANUAL",
            riskLevel: "HIGH",
            status: "PENDING",
          },
          {
            id: "vi-2",
            gateCode: "GATE-P5",
            verificationType: "AUTOMATED",
            riskLevel: "LOW",
            status: "PASSED",
          },
        ],
        message: "success",
        traceId: "tevv-trace-010",
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/verification-items")
      .query({ datasetId: "ds-1" })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("code", 0);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toHaveProperty("gateCode", "GATE-P1");
    expect(response.body.data[1]).toHaveProperty("status", "PASSED");
  });

  it("应该成功转发 POST /api/v1/verification-items 创建验证项", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 0,
          data: {
            id: "vi-3",
            gateCode: "GATE-P2",
            verificationType: "MANUAL",
            riskLevel: "MEDIUM",
            status: "PENDING",
          },
          message: "created",
          traceId: "tevv-trace-011",
        },
        201,
      ),
    );

    const response = await request(app.getHttpServer())
      .post("/api/v1/verification-items")
      .send({
        datasetId: "ds-1",
        gateCode: "GATE-P2",
        verificationType: "MANUAL",
        riskLevel: "MEDIUM",
        description: "验证项描述",
      })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-user-id", "user-001")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("id", "vi-3");
    expect(response.body.data).toHaveProperty("status", "PENDING");
  });

  it("应该成功转发 PATCH /api/v1/verification-items/:id/status 更新状态", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          id: "vi-1",
          status: "PASSED",
          verifiedAt: "2026-07-23T09:30:00Z",
        },
        message: "success",
        traceId: "tevv-trace-012",
      }),
    );

    const response = await request(app.getHttpServer())
      .patch("/api/v1/verification-items/vi-1/status")
      .query({ status: "PASSED" })
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-user-id", "user-001");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("status", "PASSED");
  });
});
