import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { VerificationItemProxyController } from "../../../src/proxy/tevv/verification-item-proxy.controller";
import type { ProxyService } from "../../../src/proxy/proxy.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
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

describe("VerificationItemProxyController", () => {
  it("GET 列表应该转发 query 到 Core Service", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new VerificationItemProxyController(proxyService);
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

  it("POST 创建应该转发 body 与授权头", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new VerificationItemProxyController(proxyService);
    const requestBody = {
      datasetId: "ds-001",
      name: "功能布局验证",
      type: "FUNCTIONAL",
      description: "验证办公建筑功能布局合理性",
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
      createProxyResult({ id: "vi-001", ...requestBody }, 201),
    );

    const result = await controller.proxy(request);

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
  });

  it("GET /{id} 详情应该透传路径参数", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new VerificationItemProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/verification-items/vi-001",
      query: {},
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "vi-001", name: "功能布局验证" }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.path).toBe("/v1/verification-items/vi-001");
    expect(callArgs.method).toBe("GET");
    expect(callArgs.body).toBeUndefined();
  });

  it("PATCH 更新应该转发 body", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new VerificationItemProxyController(proxyService);
    const requestBody = { status: "PASSED", result: "验证通过" };
    const request = createRequest({
      method: "PATCH",
      originalUrl: "/v1/verification-items/vi-001",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "vi-001", ...requestBody }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        body: requestBody,
        path: "/v1/verification-items/vi-001",
      }),
    );
  });

  it("DELETE 请求应该不携带 body", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new VerificationItemProxyController(proxyService);
    const request = createRequest({
      method: "DELETE",
      originalUrl: "/v1/verification-items/vi-001",
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
    const controller = new VerificationItemProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/verification-items/vi-001",
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "vi-001" }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });

  it("应该规范化 query 参数（数组过滤非字符串）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new VerificationItemProxyController(proxyService);
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
});
