import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { ProxyController } from "../../../src/proxy/proxy.controller";
import type { ProxyService } from "../../../src/proxy/proxy.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

/** 构造 ProxyService mock */
function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
}

/** 构造 Express Request mock */
function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/api/v1/projects",
    url: "/api/v1/projects",
    path: "/projects",
    query: {},
    body: undefined,
    traceId: "test-trace-id-123",
    header: vi.fn(() => undefined),
    headers: {},
    ...overrides,
  } as unknown as Request;
}

/** 构造 ProxyResult */
function createProxyResult<T>(data: T, status = 200): ProxyResult {
  return { status, data, headers: {} };
}

describe("ProxyController", () => {
  it("GET 请求应该转发到下游且不携带请求体", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new ProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/api/v1/projects?page=1",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    // Act
    await controller.proxy(request);

    // Assert：body 字段为 undefined（GET 不携带 body）
    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        body: undefined,
      }),
    );
  });

  it("POST 请求应该转发请求体到下游", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new ProxyController(proxyService);
    const requestBody = { name: "新项目" };
    const request = createRequest({
      method: "POST",
      originalUrl: "/api/v1/projects",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "p1" }),
    );

    // Act
    await controller.proxy(request);

    // Assert
    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: requestBody,
      }),
    );
  });

  it("DELETE 请求应该不携带请求体", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new ProxyController(proxyService);
    const request = createRequest({
      method: "DELETE",
      originalUrl: "/api/v1/projects/p1",
      body: { ignored: "should-be-stripped" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ok: true }),
    );

    // Act
    await controller.proxy(request);

    // Assert：DELETE 不应携带请求体
    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        body: undefined,
      }),
    );
  });

  it("应该透传 Authorization/x-tenant-id/x-trace-id 请求头", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new ProxyController(proxyService);
    const headersLower: Record<string, string> = {
      authorization: "Bearer test-access-token",
      [HttpHeader.X_TENANT_ID]: "tenant-1",
      [HttpHeader.X_TRACE_ID]: "test-trace-id-123",
    };
    const request = createRequest({
      method: "GET",
      originalUrl: "/api/v1/projects",
      header: vi.fn((name: string) => headersLower[name.toLowerCase()]),
      headers: headersLower,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ok: true }),
    );

    // Act
    await controller.proxy(request);

    // Assert
    const expectedHeaders = expect.objectContaining({
      authorization: "Bearer test-access-token",
      [HttpHeader.X_TENANT_ID]: "tenant-1",
      [HttpHeader.X_TRACE_ID]: "test-trace-id-123",
    });
    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expectedHeaders }),
    );
  });

  it("应该在 x-trace-id 请求头缺失时使用 request.traceId 兜底", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new ProxyController(proxyService);
    // 模拟中间件未设置请求头，但已写入 request.traceId
    const request = createRequest({
      method: "GET",
      originalUrl: "/api/v1/projects",
      traceId: "fallback-trace-id",
      header: vi.fn(() => undefined),
      headers: {},
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ok: true }),
    );

    // Act
    await controller.proxy(request);

    // Assert：x-trace-id 头使用 request.traceId
    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          [HttpHeader.X_TRACE_ID]: "fallback-trace-id",
        }),
      }),
    );
  });

  it("应该转发 originalUrl（含 query string）到下游", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new ProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/api/v1/projects?page=2&pageSize=10",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    // Act
    await controller.proxy(request);

    // Assert
    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/projects?page=2&pageSize=10",
      }),
    );
  });

  it("应该将 query 参数对象传递给下游 forward 调用", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new ProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/api/v1/projects",
      query: { page: "1", pageSize: "10" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(createProxyResult({}));

    // Act
    await controller.proxy(request);

    // Assert
    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { page: "1", pageSize: "10" },
      }),
    );
  });

  it("应该过滤 query 数组中的非字符串项", async () => {
    // Arrange
    const proxyService = createProxyServiceMock();
    const controller = new ProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/api/v1/projects",
      query: { tags: ["a", "b"], bad: [null, "valid", undefined, 123] },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(createProxyResult({}));

    // Act
    await controller.proxy(request);

    // Assert：bad 数组中只保留 "valid"
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    const query = callArgs.query as Record<string, unknown>;
    expect(query.tags).toEqual(["a", "b"]);
    expect(query.bad).toEqual(["valid"]);
  });

  it("对未知 404 路径应该照常转发（由下游决定响应）", async () => {
    // Arrange：模拟 /api/v1/unknown 路径
    const proxyService = createProxyServiceMock();
    const controller = new ProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/api/v1/unknown-path",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ error: "not found" }, 404),
    );

    // Act
    const result = await controller.proxy(request);

    // Assert：转发不抛错，由下游决定 404 响应
    expect(result.status).toBe(404);
    expect(result.data).toEqual({ error: "not found" });
  });
});
