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
            id: "550e8400-e29b-41d4-a716-446655440003",
            name: "新建数据集",
            category: "MEP",
            buildingType: "office",
            version: "1.0.0",
            fileCount: 0,
            status: "DRAFT",
            createdAt: "2026-07-25T10:00:00.000Z",
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
        buildingType: "office",
        storageKey: "golden/test",
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

  it("应该成功转发 POST /api/v1/golden-datasets/:id/freeze 冻结数据集", async () => {
    mockForward.mockResolvedValue(
      buildProxyResult({
        code: 0,
        data: {
          id: "550e8400-e29b-41d4-a716-446655440010",
          name: "办公楼金样 v1",
          category: "ARCHITECTURE",
          buildingType: "office",
          version: "1.0.0",
          fileCount: 12,
          status: "FROZEN",
          storageKey: "golden/dataset-001",
          frozenAt: "2026-07-23T09:00:00.000Z",
          createdAt: "2026-07-22T10:00:00.000Z",
        },
        message: "success",
        traceId: "tevv-trace-003",
      }),
    );

    const response = await request(app.getHttpServer())
      .post(
        "/api/v1/golden-datasets/550e8400-e29b-41d4-a716-446655440010/freeze",
      )
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-001")
      .set("x-user-id", "user-001");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("status", "FROZEN");
    expect(response.body.data).toHaveProperty("frozenAt");
  });

  it("POST /api/v1/golden-datasets 响应缺失 version 应返回 502（契约验证阻断）", async () => {
    // 模拟 Core Service 漂移：缺失 version 字段
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 0,
          data: {
            id: "550e8400-e29b-41d4-a716-446655440003",
            name: "新建数据集",
            category: "MEP",
            buildingType: "office",
            // 缺失 version 字段
            fileCount: 0,
            status: "DRAFT",
            createdAt: "2026-07-25T10:00:00.000Z",
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
        buildingType: "office",
        storageKey: "golden/test",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(502);
    expect(response.body).toHaveProperty(
      "errorCode",
      "CONTRACT_VALIDATION_FAILED",
    );
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
            id: "550e8400-e29b-41d4-a716-446655440003",
            datasetId: "550e8400-e29b-41d4-a716-446655440001",
            gateCode: "GATE-P2",
            verificationType: "MANUAL",
            riskLevel: "MEDIUM",
            status: "PENDING",
            description: "验证项描述",
            createdAt: "2026-07-25T10:00:00.000Z",
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
        datasetId: "550e8400-e29b-41d4-a716-446655440001",
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
    expect(response.body.data).toHaveProperty(
      "id",
      "550e8400-e29b-41d4-a716-446655440003",
    );
    expect(response.body.data).toHaveProperty("status", "PENDING");
    expect(response.body.data).toHaveProperty("riskLevel", "MEDIUM");
  });

  it("POST /api/v1/verification-items 响应缺失 riskLevel 应返回 502（AI 安全红线阻断）", async () => {
    // 模拟 Core Service 漂移：缺失 riskLevel 字段
    mockForward.mockResolvedValue(
      buildProxyResult(
        {
          code: 0,
          data: {
            id: "550e8400-e29b-41d4-a716-446655440003",
            datasetId: "550e8400-e29b-41d4-a716-446655440001",
            gateCode: "GATE-P2",
            verificationType: "MANUAL",
            // 缺失 riskLevel 字段
            status: "PENDING",
            description: "验证项描述",
            createdAt: "2026-07-25T10:00:00.000Z",
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
        datasetId: "550e8400-e29b-41d4-a716-446655440001",
        gateCode: "GATE-P2",
        verificationType: "MANUAL",
        riskLevel: "MEDIUM",
        description: "验证项描述",
      })
      .set("Authorization", "Bearer test-token")
      .set("Content-Type", "application/json");

    expect(response.status).toBe(502);
    expect(response.body).toHaveProperty(
      "errorCode",
      "CONTRACT_VALIDATION_FAILED",
    );
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
