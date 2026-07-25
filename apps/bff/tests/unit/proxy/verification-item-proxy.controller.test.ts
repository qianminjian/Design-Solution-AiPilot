import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { VerificationItemProxyController } from "../../../src/proxy/tevv/verification-item-proxy.controller";
import type { ProxyService } from "../../../src/proxy/proxy.service";
import { SchemaValidator } from "../../../src/proxy/schema-validator.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
}

/** 构造真实 SchemaValidator（无依赖服务，直接实例化） */
function createSchemaValidator(): SchemaValidator {
  return new SchemaValidator();
}

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/v1/verification-items",
    url: "/v1/verification-items",
    path: "/verification-items",
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

/** 合法的验证项 fixture（符合 verificationItemDtoSchema） */
const validVerificationItem = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  datasetId: "550e8400-e29b-41d4-a716-446655440001",
  gateCode: "GATE-6",
  verificationType: "MANUAL" as const,
  riskLevel: "MEDIUM" as const,
  status: "PENDING" as const,
  description: "建筑专业功能布局验证",
  createdAt: "2026-07-25T10:00:00.000Z",
};

describe("VerificationItemProxyController", () => {
  it("GET 列表应该转发 query 到 Core Service（透传，不走严格验证）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new VerificationItemProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/verification-items?datasetId=ds-001&type=FUNCTIONAL",
      query: { datasetId: "ds-001", type: "FUNCTIONAL" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [], total: 0 }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/verification-items?datasetId=ds-001&type=FUNCTIONAL",
        query: { datasetId: "ds-001", type: "FUNCTIONAL" },
        body: undefined,
      }),
    );
  });

  it("POST 创建应该转发 body 与授权头并通过严格 schema 验证", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new VerificationItemProxyController(
      proxyService,
      schemaValidator,
    );
    const requestBody = {
      datasetId: "550e8400-e29b-41d4-a716-446655440001",
      gateCode: "GATE-6",
      verificationType: "MANUAL",
      riskLevel: "MEDIUM",
      description: "建筑专业功能布局验证",
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
      createProxyResult({ ...validVerificationItem }, 201),
    );

    const result = await controller.create(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: requestBody,
        path: "/v1/verification-items",
      }),
    );
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
      "x-user-id": "user-001",
    });
    expect(result.status).toBe(201);
    expect(result.data).toMatchObject({ riskLevel: "MEDIUM" });
  });

  it("POST 创建响应缺失 riskLevel 应抛 502（AI 安全红线阻断）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new VerificationItemProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      body: {},
    });
    // 缺失 riskLevel 字段（前端依赖此字段决定人工复核等级）
    const brokenResponse = {
      ...validVerificationItem,
      riskLevel: undefined,
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

  it("POST 创建响应 riskLevel 为非枚举值应抛 502", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new VerificationItemProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      body: {},
    });
    // riskLevel 必须为 LOW/MEDIUM/HIGH/CRITICAL，其他值应阻断
    const brokenResponse = {
      ...validVerificationItem,
      riskLevel: "INVALID",
    };
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
    const controller = new VerificationItemProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl:
        "/v1/verification-items/550e8400-e29b-41d4-a716-446655440000",
      query: {},
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ...validVerificationItem }),
    );

    const result = await controller.getById(
      request,
      "550e8400-e29b-41d4-a716-446655440000",
    );

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.path).toBe(
      "/v1/verification-items/550e8400-e29b-41d4-a716-446655440000",
    );
    expect(callArgs.method).toBe("GET");
    expect(callArgs.body).toBeUndefined();
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ riskLevel: "MEDIUM" });
  });

  it("GET /:id 响应缺失 status 字段应抛 502", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new VerificationItemProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl:
        "/v1/verification-items/550e8400-e29b-41d4-a716-446655440000",
    });
    const brokenResponse = {
      ...validVerificationItem,
      status: undefined,
    };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(brokenResponse, 200),
    );

    await expect(
      controller.getById(request, "550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toMatchObject({
      status: 502,
    });
  });

  it("PATCH 更新应该走通配符透传（不走严格验证）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new VerificationItemProxyController(
      proxyService,
      schemaValidator,
    );
    const requestBody = { status: "PASSED", waiverReason: "验证通过" };
    const request = createRequest({
      method: "PATCH",
      originalUrl:
        "/v1/verification-items/550e8400-e29b-41d4-a716-446655440000",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ...validVerificationItem, status: "PASSED" }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        body: requestBody,
        path: "/v1/verification-items/550e8400-e29b-41d4-a716-446655440000",
      }),
    );
  });

  it("DELETE 请求应该不携带 body", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new VerificationItemProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "DELETE",
      originalUrl:
        "/v1/verification-items/550e8400-e29b-41d4-a716-446655440000",
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

  it("应该在请求头未携带 traceId 时使用 request.traceId 兜底", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new VerificationItemProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl:
        "/v1/verification-items/550e8400-e29b-41d4-a716-446655440000",
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ...validVerificationItem }),
    );

    await controller.getById(request, "550e8400-e29b-41d4-a716-446655440000");

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });

  it("应该规范化 query 参数（数组过滤非字符串）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new VerificationItemProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/verification-items?status=PASSED&status=FAILED",
      query: {
        status: ["PASSED", "FAILED"],
      },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.query).toEqual({ status: ["PASSED", "FAILED"] });
  });

  it("非 2xx 状态码响应应直接透传，不触发 schema 验证", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new VerificationItemProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl:
        "/v1/verification-items/550e8400-e29b-41d4-a716-446655440000",
    });
    // 模拟 404 错误响应
    const errorResponse = {
      errorCode: "VERIFICATION_ITEM_NOT_FOUND",
      message: "验证项不存在",
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
});
