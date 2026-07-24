import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { GoldenDatasetProxyController } from "../../../src/proxy/tevv/tevv-proxy.controller";
import type { ProxyService } from "../../../src/proxy/proxy.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
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

describe("GoldenDatasetProxyController", () => {
  it("GET 列表应该转发 query 到 Core Service", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new GoldenDatasetProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/golden-datasets?category=SCHEME_DESIGN&status=ACTIVE",
      query: { category: "SCHEME_DESIGN", status: "ACTIVE" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [], total: 0 }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/golden-datasets?category=SCHEME_DESIGN&status=ACTIVE",
        query: { category: "SCHEME_DESIGN", status: "ACTIVE" },
        body: undefined,
      }),
    );
  });

  it("POST 创建应该转发 body 与授权头", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new GoldenDatasetProxyController(proxyService);
    const requestBody = {
      name: "办公建筑方案集",
      category: "SCHEME_DESIGN",
      description: "中小型办公建筑方案数据集",
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
      createProxyResult({ id: "ds-001", ...requestBody }, 201),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: requestBody,
        path: "/v1/golden-datasets",
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
    const controller = new GoldenDatasetProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/golden-datasets/ds-001",
      query: {},
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "ds-001", name: "办公建筑方案集" }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.path).toBe("/v1/golden-datasets/ds-001");
    expect(callArgs.method).toBe("GET");
    expect(callArgs.body).toBeUndefined();
  });

  it("DELETE 请求应该不携带 body", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new GoldenDatasetProxyController(proxyService);
    const request = createRequest({
      method: "DELETE",
      originalUrl: "/v1/golden-datasets/ds-001",
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
    const controller = new GoldenDatasetProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/golden-datasets/ds-001",
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "ds-001" }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });
});
