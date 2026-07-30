import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { AnalysisProxyController } from "../../../src/proxy/analysis/analysis-proxy.controller";
import type { ProxyService } from "../../../src/proxy/proxy.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
}

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/v1/analysis/problems",
    url: "/v1/analysis/problems",
    path: "/analysis/problems",
    query: {},
    body: undefined,
    traceId: "test-trace-id-analysis-001",
    header: vi.fn(() => undefined),
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createProxyResult<T>(data: T, status = 200): ProxyResult {
  return { status, data, headers: {} };
}

describe("AnalysisProxyController", () => {
  it("GET /v1/analysis/problems 应该透传查询参数与授权头", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const headerMock = vi.fn((name: string) => {
      const map: Record<string, string> = {
        [HttpHeader.AUTHORIZATION]: "Bearer token-analysis",
        [HttpHeader.X_TENANT_ID]: "tenant-001",
        "x-user-id": "user-001",
      };
      return map[name];
    });
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/analysis/problems?type=STRUCTURAL&page=1&pageSize=20",
      query: { type: "STRUCTURAL", page: "1", pageSize: "20" },
      header: headerMock,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [], total: 0 }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/analysis/problems?type=STRUCTURAL&page=1&pageSize=20",
        query: { type: "STRUCTURAL", page: "1", pageSize: "20" },
      }),
    );
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-analysis",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
      "x-user-id": "user-001",
    });
    expect(callArgs.body).toBeUndefined();
  });

  it("POST /v1/analysis/problems 应该转发 body（创建草稿）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const requestBody = {
      title: "结构抗震分析",
      type: "STRUCTURAL",
      projectId: "proj-001",
      owner: "user-001",
      ownerRole: "STRUCTURAL_ENGINEER",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/analysis/problems",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(
        { id: "prob-001", code: "ANL-001", status: "DRAFT" },
        201,
      ),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/analysis/problems",
        body: requestBody,
      }),
    );
    expect(result.status).toBe(201);
  });

  it("POST /v1/analysis/problems/:id/invalidate 应该转发高风险动作 body（含 stepUpToken）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const requestBody = {
      reason: "Baseline 模型已更新，原分析结果失效",
      stepUpToken: "step-up-token-xxx",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/analysis/problems/prob-001/invalidate",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "prob-001", status: "INVALID" }, 200),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/analysis/problems/prob-001/invalidate",
        body: requestBody,
      }),
    );
    expect(result.status).toBe(200);
  });

  it("POST /v1/analysis/runs/:id/cancel 应该转发取消运行 body（含 stepUpToken）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const requestBody = {
      reason: "需求变更，取消运行",
      stepUpToken: "step-up-token-yyy",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/analysis/runs/run-001/cancel",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "run-001", status: "CANCELLED" }, 200),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/analysis/runs/run-001/cancel",
        body: requestBody,
      }),
    );
    expect(result.status).toBe(200);
  });

  it("POST /v1/analysis/results/:id/quality-assessment 应该转发质量评估 body（含 sealId）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const requestBody = {
      decision: "ACCEPT_AS_REVISION",
      reviewer: "user-architect-001",
      reviewerRole: "PRINCIPAL_ARCHITECT",
      reason: "结果符合规范要求，接受为修订版",
      sealId: "seal-001",
      stepUpToken: "step-up-token-zzz",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/analysis/results/res-001/quality-assessment",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "qa-001", resultId: "res-001" }, 201),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/analysis/results/res-001/quality-assessment",
        body: requestBody,
      }),
    );
    expect(result.status).toBe(201);
  });

  it("DELETE /v1/analysis/problems/:id 应该透传（body 为 undefined）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const request = createRequest({
      method: "DELETE",
      originalUrl: "/v1/analysis/problems/prob-draft-001",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(null, 204),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        body: undefined,
      }),
    );
    expect(result.status).toBe(204);
  });

  it("GET /v1/analysis/problems/:id/scenarios 应该透传子资源路径", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/analysis/problems/prob-001/scenarios",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/analysis/problems/prob-001/scenarios",
      }),
    );
  });

  it("GET /v1/analysis/runs/:id/timeline 应该透传运行时间线路径", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/analysis/runs/run-001/timeline",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/analysis/runs/run-001/timeline",
      }),
    );
  });

  it("GET /v1/analysis/solver-profiles 应该透传求解器配置列表路径", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/analysis/solver-profiles",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/analysis/solver-profiles",
      }),
    );
  });

  it("traceId fallback：请求头未携带 x-trace-id 时使用 request.traceId", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/analysis/problems",
      traceId: "fallback-trace-id-analysis",
      header: vi.fn(() => undefined),
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe(
      "fallback-trace-id-analysis",
    );
  });

  it("非 2xx 响应应该原样透传（如 404 后端未实现）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/analysis/problems/prob-001",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ message: "Not Found" }, 404),
    );

    const result = await controller.proxy(request);

    expect(result.status).toBe(404);
  });

  it("query 数组参数应该归一化为 string[]", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/analysis/problems?status=RUNNING&status=COMPLETED",
      query: { status: ["RUNNING", "COMPLETED"] },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.query).toEqual({ status: ["RUNNING", "COMPLETED"] });
  });

  it("GET /v1/analysis/problems/:id/mesh-quality 应该透传网格质量路径", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/analysis/problems/prob-001/mesh-quality",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ totalElements: 0, qualityGrade: "A" }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/analysis/problems/prob-001/mesh-quality",
      }),
    );
  });

  it("POST /v1/analysis/results/:id/impact-proposal 应该转发变更影响提案 body（含 stepUpToken）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new AnalysisProxyController(proxyService);
    const requestBody = {
      title: "基于分析结果调整构件截面",
      stepUpToken: "step-up-token-impact",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/analysis/results/res-001/impact-proposal",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ proposalId: "prop-001" }, 201),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/analysis/results/res-001/impact-proposal",
        body: requestBody,
      }),
    );
    expect(result.status).toBe(201);
  });
});
