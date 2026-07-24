import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { WorkflowProxyController } from "../../../src/proxy/workflow/workflow-proxy.controller";
import type { ProxyService } from "../../../src/proxy/proxy.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
}

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/v1/workflow/stages",
    url: "/v1/workflow/stages",
    path: "/workflow/stages",
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

describe("WorkflowProxyController", () => {
  it("GET /stages 应该转发阶段列表请求到 Core Service", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new WorkflowProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/workflow/stages?projectId=p-001",
      query: { projectId: "p-001" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [], total: 0 }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/workflow/stages?projectId=p-001",
        query: { projectId: "p-001" },
        body: undefined,
      }),
    );
  });

  it("POST /gates/{id}/decide 应该转发门控决策 body", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new WorkflowProxyController(proxyService);
    const requestBody = {
      decision: "APPROVED",
      comment: "通过评审",
    };
    const headerMock = vi.fn((name: string) => {
      const map: Record<string, string> = {
        [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
        [HttpHeader.X_TENANT_ID]: "tenant-001",
        "x-user-id": "reviewer-001",
        "content-type": "application/json",
      };
      return map[name];
    });
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/workflow/gates/gate-001/decide",
      body: requestBody,
      header: headerMock,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "gate-001", status: "APPROVED" }, 200),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: requestBody,
        path: "/v1/workflow/gates/gate-001/decide",
      }),
    );
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
      "x-user-id": "reviewer-001",
    });
    expect(result.status).toBe(200);
  });

  it("POST /baselines/{id}/freeze 应该转发基线冻结请求", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new WorkflowProxyController(proxyService);
    const requestBody = {
      reason: "阶段评审通过，冻结基线",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/workflow/baselines/base-001/freeze",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "base-001", status: "FROZEN" }, 200),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: requestBody,
        path: "/v1/workflow/baselines/base-001/freeze",
      }),
    );
    expect(result.status).toBe(200);
  });

  it("DELETE 请求应该不携带 body", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new WorkflowProxyController(proxyService);
    const request = createRequest({
      method: "DELETE",
      originalUrl: "/v1/workflow/something/123",
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
    const controller = new WorkflowProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/workflow/stages",
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });

  it("应该规范化 query 参数（数组过滤非字符串）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new WorkflowProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/workflow/stages?status=ACTIVE&status=FROZEN",
      query: {
        status: ["ACTIVE", "FROZEN"],
      },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.query).toEqual({ status: ["ACTIVE", "FROZEN"] });
  });
});
