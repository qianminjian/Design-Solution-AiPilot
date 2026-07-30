import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { OperationsProxyController } from "../../../src/proxy/operations/operations-proxy.controller";
import type { ProxyService } from "../../../src/proxy/proxy.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
}

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/v1/operations/overview",
    url: "/v1/operations/overview",
    path: "/operations/overview",
    query: {},
    body: undefined,
    traceId: "test-trace-id-ops-001",
    header: vi.fn(() => undefined),
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createProxyResult<T>(data: T, status = 200): ProxyResult {
  return { status, data, headers: {} };
}

describe("OperationsProxyController", () => {
  it("GET /v1/operations/overview 应该透传授权头", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const headerMock = vi.fn((name: string) => {
      const map: Record<string, string> = {
        [HttpHeader.AUTHORIZATION]: "Bearer token-ops",
        [HttpHeader.X_TENANT_ID]: "tenant-001",
        "x-user-id": "user-001",
      };
      return map[name];
    });
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/operations/overview",
      header: headerMock,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({
        runningTasks: 5,
        queuedTasks: 10,
        failedTasks: 2,
        runningWorkers: 3,
        errorWorkers: 1,
        connectedConnectors: 4,
        degradedConnectors: 1,
        disconnectedConnectors: 0,
        criticalSlos: 0,
        hasRetryStorm: false,
        hasUnknownJobs: false,
      }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/operations/overview",
      }),
    );
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-ops",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
      "x-user-id": "user-001",
    });
    expect(callArgs.body).toBeUndefined();
  });

  it("GET /v1/operations/slos 应该透传 SLO 列表查询", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/operations/slos",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/operations/slos",
      }),
    );
  });

  it("GET /v1/operations/queue 应该透传队列查询参数", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/operations/queue?status=running&page=1",
      query: { status: "running", page: "1" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [], total: 0 }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/operations/queue?status=running&page=1",
        query: { status: "running", page: "1" },
      }),
    );
  });

  it("GET /v1/operations/workers/:id 应该透传 Worker 详情路径", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/operations/workers/worker-001",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "worker-001", status: "running" }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/operations/workers/worker-001",
      }),
    );
  });

  it("POST /v1/operations/action 应该转发危险动作 body（含 stepUpToken）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const requestBody = {
      actionType: "isolate",
      targetType: "worker",
      targetId: "worker-001",
      reason: "Worker 持续报错，需隔离排查",
      impactPreviewAcknowledged: true,
      stepUpToken: "step-up-token-xxx",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/operations/action",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(
        { actionId: "act-001", status: "EXECUTED", actionType: "isolate" },
        200,
      ),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/operations/action",
        body: requestBody,
      }),
    );
    expect(result.status).toBe(200);
  });

  it("traceId fallback：请求头未携带 x-trace-id 时使用 request.traceId", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/operations/overview",
      traceId: "fallback-trace-id-ops",
      header: vi.fn(() => undefined),
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ runningTasks: 0 }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe(
      "fallback-trace-id-ops",
    );
  });

  it("非 2xx 响应应该原样透传（如 501 后端未实现）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/operations/slos",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(
        { errorCode: "NOT_IMPLEMENTED", message: "Operations API V1 待实现" },
        501,
      ),
    );

    const result = await controller.proxy(request);

    expect(result.status).toBe(501);
    expect(result.data).toMatchObject({ errorCode: "NOT_IMPLEMENTED" });
  });

  it("GET /v1/operations/connectors 应该透传连接器列表查询", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/operations/connectors?type=ai_provider",
      query: { type: "ai_provider" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/operations/connectors?type=ai_provider",
        query: { type: "ai_provider" },
      }),
    );
  });

  // ── Queue 任务子动作端点路径对齐验证（D37.17 §状态机） ──

  it("POST /v1/operations/queue/:id/pause 应该透传暂停任务请求", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/operations/queue/task-001/pause",
      body: { reason: "下游服务异常，暂停处理" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "task-001", status: "paused" }, 200),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/operations/queue/task-001/pause",
        body: { reason: "下游服务异常，暂停处理" },
      }),
    );
    expect(result.status).toBe(200);
  });

  it("POST /v1/operations/queue/:id/resume 应该透传恢复任务请求", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/operations/queue/task-001/resume",
      body: { reason: "下游服务恢复" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "task-001", status: "running" }, 200),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/operations/queue/task-001/resume",
      }),
    );
  });

  it("POST /v1/operations/queue/:id/retry 应该透传重试任务请求", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/operations/queue/task-001/retry",
      body: { stepUpToken: "step-up-token-retry" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "task-001", retryCount: 1 }, 200),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/operations/queue/task-001/retry",
        body: { stepUpToken: "step-up-token-retry" },
      }),
    );
  });

  it("POST /v1/operations/queue/:id/cancel 应该透传取消任务请求（含 stepUpToken）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const requestBody = {
      reason: "需求变更，取消任务",
      stepUpToken: "step-up-token-cancel",
      impactPreviewAcknowledged: true,
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/operations/queue/task-001/cancel",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "task-001", status: "cancelled" }, 200),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/operations/queue/task-001/cancel",
        body: requestBody,
      }),
    );
    expect(result.status).toBe(200);
  });

  // ── Worker 子动作端点路径对齐验证（D37.17 §Worker 治理） ──

  it("POST /v1/operations/workers/:id/pause 应该透传暂停 Worker 请求", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/operations/workers/worker-001/pause",
      body: { reason: "维护窗口，暂停 Worker" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "worker-001", status: "stopped" }, 200),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/operations/workers/worker-001/pause",
        body: { reason: "维护窗口，暂停 Worker" },
      }),
    );
  });

  it("POST /v1/operations/workers/:id/resume 应该透传恢复 Worker 请求", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/operations/workers/worker-001/resume",
      body: { reason: "维护完成" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "worker-001", status: "running" }, 200),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/operations/workers/worker-001/resume",
      }),
    );
  });

  // ── query 数组参数归一化（对齐 Analysis 域测试覆盖） ──

  it("query 数组参数应该归一化为 string[]", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new OperationsProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/operations/queue?status=running&status=queued",
      query: { status: ["running", "queued"] },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.query).toEqual({ status: ["running", "queued"] });
  });
});
