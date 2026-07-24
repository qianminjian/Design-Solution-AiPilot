import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { DesignOptionProxyController } from "../../../src/proxy/design/design-option-proxy.controller";
import type { ProxyService } from "../../../src/proxy/proxy.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
}

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/v1/design-options",
    url: "/v1/design-options",
    path: "/design-options",
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

describe("DesignOptionProxyController", () => {
  it("GET 列表应该转发 query 到 Core Service", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new DesignOptionProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/design-options?projectId=p-001&status=DRAFT",
      query: { projectId: "p-001", status: "DRAFT" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [], total: 0 }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/design-options?projectId=p-001&status=DRAFT",
        query: { projectId: "p-001", status: "DRAFT" },
        body: undefined,
      }),
    );
  });

  it("POST 创建设计选项应该转发 body 与授权头", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new DesignOptionProxyController(proxyService);
    const requestBody = {
      projectId: "p-001",
      name: "方案 A",
      description: "初始方案",
      discipline: "ARCHITECTURE",
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
      originalUrl: "/v1/design-options",
      body: requestBody,
      header: headerMock,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "opt-001", ...requestBody }, 201),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: requestBody,
        path: "/v1/design-options",
      }),
    );
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
      "x-user-id": "user-001",
      "content-type": "application/json",
    });
    expect(result.status).toBe(201);
  });

  it("GET /{id} 详情应该透传路径参数", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new DesignOptionProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/design-options/opt-001",
      query: {},
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "opt-001", name: "方案 A" }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.path).toBe("/v1/design-options/opt-001");
    expect(callArgs.method).toBe("GET");
    expect(callArgs.body).toBeUndefined();
  });

  it("PATCH 更新应该转发 body", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new DesignOptionProxyController(proxyService);
    const requestBody = { name: "方案 A-修订版", status: "REVIEW" };
    const request = createRequest({
      method: "PATCH",
      originalUrl: "/v1/design-options/opt-001",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "opt-001", ...requestBody }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        body: requestBody,
        path: "/v1/design-options/opt-001",
      }),
    );
  });

  it("DELETE 请求应该不携带 body", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new DesignOptionProxyController(proxyService);
    const request = createRequest({
      method: "DELETE",
      originalUrl: "/v1/design-options/opt-001",
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
    const controller = new DesignOptionProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/design-options/opt-001",
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "opt-001" }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });

  it("应该规范化 query 参数（数组过滤非字符串）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new DesignOptionProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/design-options?status=DRAFT&status=REVIEW",
      query: {
        status: ["DRAFT", "REVIEW"],
      },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.query).toEqual({ status: ["DRAFT", "REVIEW"] });
  });
});
