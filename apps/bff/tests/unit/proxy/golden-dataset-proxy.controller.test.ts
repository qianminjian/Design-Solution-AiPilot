import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { GoldenDatasetProxyController } from "../../../src/proxy/tevv/tevv-proxy.controller";
import type { ProxyService } from "../../../src/proxy/proxy.service";
import { SchemaValidator } from "../../../src/proxy/schema-validator.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
}

function createSchemaValidator(): SchemaValidator {
  return new SchemaValidator();
}

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/v1/golden-datasets",
    url: "/v1/golden-datasets",
    path: "/golden-datasets",
    query: {},
    body: undefined,
    traceId: "test-trace-id-123",
    header: vi.fn(() => undefined),
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createProxyResult<T>(data: T, status = 200): ProxyResult {
  return { status, data, headers: {} };
}

/** 合法的金样数据集 fixture（符合 goldenDatasetDtoSchema） */
const validGoldenDataset = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "办公楼金样 v1",
  description: "建筑专业金样数据集",
  category: "ARCHITECTURE" as const,
  buildingType: "office",
  version: "1.0.0",
  fileCount: 12,
  totalSizeBytes: 1024,
  status: "DRAFT" as const,
  storageKey: "golden/dataset-001",
  createdAt: "2026-07-25T10:00:00.000Z",
};

describe("GoldenDatasetProxyController", () => {
  it("GET 列表应该走通配符透传（不走严格验证）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GoldenDatasetProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/golden-datasets?category=ARCHITECTURE",
      query: { category: "ARCHITECTURE" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [], total: 0 }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/golden-datasets?category=ARCHITECTURE",
        query: { category: "ARCHITECTURE" },
      }),
    );
  });

  it("POST 创建应该转发 body 并通过严格 schema 验证", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GoldenDatasetProxyController(
      proxyService,
      schemaValidator,
    );
    const requestBody = {
      name: "办公楼金样 v1",
      category: "ARCHITECTURE",
      buildingType: "office",
      storageKey: "golden/dataset-001",
    };
    const headerMock = vi.fn((name: string) => {
      const map: Record<string, string> = {
        [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
        [HttpHeader.X_TENANT_ID]: "tenant-001",
        "x-user-id": "user-001",
        "content-type": "application/json",
      };
      return map[name];
    });
    const request = createRequest({
      method: "POST",
      body: requestBody,
      header: headerMock,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ...validGoldenDataset }, 201),
    );

    const result = await controller.create(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: requestBody,
      }),
    );
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
    });
    expect(result.status).toBe(201);
    expect(result.data).toMatchObject({ status: "DRAFT" });
  });

  it("POST 创建响应缺失 status 应抛 502", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GoldenDatasetProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({ method: "POST", body: {} });
    const brokenResponse = {
      ...validGoldenDataset,
      status: undefined,
    };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(brokenResponse, 201),
    );

    await expect(controller.create(request)).rejects.toMatchObject({
      status: 502,
      response: {
        errorCode: "CONTRACT_VALIDATION_FAILED",
      },
    });
  });

  it("POST 创建响应 category 为非枚举值应抛 502", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GoldenDatasetProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({ method: "POST", body: {} });
    const brokenResponse = {
      ...validGoldenDataset,
      category: "INVALID",
    };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(brokenResponse, 201),
    );

    await expect(controller.create(request)).rejects.toMatchObject({
      status: 502,
    });
  });

  it("POST 创建响应缺失 version 应抛 502", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GoldenDatasetProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({ method: "POST", body: {} });
    const brokenResponse = { ...validGoldenDataset, version: undefined };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(brokenResponse, 201),
    );

    await expect(controller.create(request)).rejects.toMatchObject({
      status: 502,
    });
  });

  it("GET /:id 详情应该透传路径参数并通过严格 schema 验证", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GoldenDatasetProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/golden-datasets/550e8400-e29b-41d4-a716-446655440000",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ...validGoldenDataset }),
    );

    const result = await controller.getById(
      request,
      "550e8400-e29b-41d4-a716-446655440000",
    );

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.method).toBe("GET");
    expect(callArgs.body).toBeUndefined();
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ status: "DRAFT" });
  });

  it("POST /:id/freeze 冻结应该通过严格 schema 验证（含 frozenAt）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GoldenDatasetProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl:
        "/v1/golden-datasets/550e8400-e29b-41d4-a716-446655440000/freeze",
    });
    // 冻结后的响应：status 升级为 FROZEN，含 frozenAt
    const frozenDataset = {
      ...validGoldenDataset,
      status: "FROZEN",
      frozenAt: "2026-07-25T11:00:00.000Z",
    };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(frozenDataset),
    );

    const result = await controller.freeze(
      request,
      "550e8400-e29b-41d4-a716-446655440000",
    );

    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({
      status: "FROZEN",
      frozenAt: "2026-07-25T11:00:00.000Z",
    });
  });

  it("POST /:id/freeze 响应缺失 version 字段应抛 502（契约验证阻断）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GoldenDatasetProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl:
        "/v1/golden-datasets/550e8400-e29b-41d4-a716-446655440000/freeze",
    });
    // 缺失 version 字段（违反 goldenDatasetDtoSchema）
    const brokenResponse = {
      ...validGoldenDataset,
      status: "FROZEN",
      frozenAt: "2026-07-25T11:00:00.000Z",
      version: undefined,
    };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(brokenResponse),
    );

    await expect(
      controller.freeze(request, "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toMatchObject({
      status: 502,
      response: {
        errorCode: "CONTRACT_VALIDATION_FAILED",
      },
    });
  });

  it("DELETE 请求应该不携带 body", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GoldenDatasetProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "DELETE",
      originalUrl: "/v1/golden-datasets/550e8400-e29b-41d4-a716-446655440000",
      body: { ignored: true },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(null, 204),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        body: undefined,
      }),
    );
  });

  it("非 2xx 状态码响应应直接透传", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GoldenDatasetProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/golden-datasets/550e8400-e29b-41d4-a716-446655440000",
    });
    const errorResponse = {
      errorCode: "DATASET_NOT_FOUND",
      message: "数据集不存在",
    };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(errorResponse, 404),
    );

    const result = await controller.getById(
      request,
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(result.status).toBe(404);
    expect(result.data).toEqual(errorResponse);
  });

  it("应该兼容 ApiResponse<T> 包装格式", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GoldenDatasetProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({ method: "POST", body: {} });
    const wrappedResponse = {
      code: 0,
      data: { ...validGoldenDataset },
      message: "created",
      traceId: "trace-001",
    };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(wrappedResponse, 201),
    );

    const result = await controller.create(request);

    expect(result.status).toBe(201);
    const data = result.data as { code: number; data: unknown };
    expect(data.code).toBe(0);
    expect(data.data).toMatchObject({ status: "DRAFT" });
  });
});
