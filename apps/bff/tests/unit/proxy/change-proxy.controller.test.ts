import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { ChangeProxyController } from "../../../src/proxy/change/change-proxy.controller";
import type { ProxyService } from "../../../src/proxy/proxy.service";
import type { ProxyResult } from "../../../src/interceptors/proxy.interceptor";

function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
}

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    originalUrl: "/v1/changes",
    url: "/v1/changes",
    path: "/changes",
    query: {},
    body: undefined,
    traceId: "test-trace-id-chg-001",
    header: vi.fn(() => undefined),
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createProxyResult<T>(data: T, status = 200): ProxyResult {
  return { status, data, headers: {} };
}

describe("ChangeProxyController", () => {
  it("GET /v1/changes 应该透传授权头与查询参数", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const headerMock = vi.fn((name: string) => {
      const map: Record<string, string> = {
        [HttpHeader.AUTHORIZATION]: "Bearer token-chg",
        [HttpHeader.X_TENANT_ID]: "tenant-001",
        "x-user-id": "user-001",
      };
      return map[name];
    });
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/changes?status=approved&page=1",
      query: { status: "approved", page: "1" },
      header: headerMock,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [], total: 0 }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/changes?status=approved&page=1",
        query: { status: "approved", page: "1" },
      }),
    );
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-chg",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
      "x-user-id": "user-001",
    });
    expect(callArgs.body).toBeUndefined();
  });

  it("POST /v1/changes 应该转发 body", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const requestBody = {
      title: "增加阳台栏杆高度",
      type: "DESIGN_CHANGE",
      priority: "MAJOR",
      projectId: "proj-001",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/changes",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "chg-001", status: "DRAFT" }, 201),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/changes",
        body: requestBody,
      }),
    );
    expect(result.status).toBe(201);
  });

  it("POST /v1/changes/:id/approve 应该转发高风险动作 body（含 stepUpToken）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const requestBody = {
      comment: "评估通过，准予批准",
      stepUpToken: "step-up-token-xxx",
      responsibilityAcknowledged: true,
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/changes/chg-001/approve",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "chg-001", status: "APPROVED" }, 200),
    );

    const result = await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/changes/chg-001/approve",
        body: requestBody,
      }),
    );
    expect(result.status).toBe(200);
  });

  it("DELETE /v1/changes/:id 应该透传（body 为 undefined）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const request = createRequest({
      method: "DELETE",
      originalUrl: "/v1/changes/chg-draft-001",
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

  it("GET /v1/changes/:id/affected-items 应该透传子资源路径", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/changes/chg-001/affected-items",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/changes/chg-001/affected-items",
      }),
    );
  });

  it("traceId fallback：请求头未携带 x-trace-id 时使用 request.traceId", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/changes",
      traceId: "fallback-trace-id-chg",
      header: vi.fn(() => undefined),
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe(
      "fallback-trace-id-chg",
    );
  });

  it("非 2xx 响应应该原样透传（如 404 后端未实现）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/changes/chg-001",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(
        { errorCode: "NOT_FOUND", message: "ChangeRequest not found" },
        404,
      ),
    );

    const result = await controller.proxy(request);

    expect(result.status).toBe(404);
    expect(result.data).toMatchObject({ errorCode: "NOT_FOUND" });
  });

  it("POST /v1/changes/:id/task-plans/:generate 应该透传 generate 动作", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const requestBody = { strategy: "AUTO" };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/changes/chg-001/task-plans/:generate",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }, 200),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/changes/chg-001/task-plans/:generate",
        body: requestBody,
      }),
    );
  });

  // ── 状态流转端点路径对齐验证（D37.16 §状态机） ──

  it("POST /v1/changes/:id/submit-impact 应该透传提交影响评估请求", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const requestBody = {
      impactAssessment: '{"summary":"已识别 3 个受影响图纸"}',
      confirmedNoImpact: false,
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/changes/chg-001/submit-impact",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "chg-001", status: "PENDING_APPROVAL" }, 200),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/changes/chg-001/submit-impact",
        body: requestBody,
      }),
    );
  });

  it("POST /v1/changes/:id/reject 应该透传拒绝变更请求（含 stepUpToken）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const requestBody = {
      reason: "影响评估不充分，需补充分析",
      stepUpToken: "step-up-token-reject",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/changes/chg-001/reject",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "chg-001", status: "REJECTED" }, 200),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/changes/chg-001/reject",
        body: requestBody,
      }),
    );
  });

  it("POST /v1/changes/:id/recall 应该透传撤回变更请求", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const requestBody = {
      reason: "发起人主动撤回，需重新评估方案",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/changes/chg-001/recall",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "chg-001", status: "RECALLED" }, 200),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/changes/chg-001/recall",
        body: requestBody,
      }),
    );
  });

  it("POST /v1/changes/:id/verify-closure 应该透传验证关闭请求（含 stepUpToken + 责任确认）", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const requestBody = {
      verificationResult: "PASSED",
      verificationNote: "所有处置任务已完成且证据齐全",
      stepUpToken: "step-up-token-closure",
      responsibilityAcknowledged: true,
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/changes/chg-001/verify-closure",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "chg-001", status: "CLOSED" }, 200),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/changes/chg-001/verify-closure",
        body: requestBody,
      }),
    );
  });

  // ── 子实体动作端点路径对齐验证（冒号语法） ──

  it("POST /v1/changes/:id/affected-items/:itemId:recheck 应该透传 recheck 动作", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/changes/chg-001/affected-items/aff-001:recheck",
      body: {},
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "aff-001", status: "RECHECKING" }, 200),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/changes/chg-001/affected-items/aff-001:recheck",
      }),
    );
  });

  it("POST /v1/changes/:id/closure-evidences/:evidenceId:verify 应该透传 verify 动作", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/changes/chg-001/closure-evidences/evd-001:verify",
      body: { verified: true },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "evd-001", verified: true }, 200),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/changes/chg-001/closure-evidences/evd-001:verify",
      }),
    );
  });

  it("POST /v1/changes/:id/task-plans/:itemId:start 应该透传 start 动作", async () => {
    const proxyService = createProxyServiceMock();
    const controller = new ChangeProxyController(proxyService);
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/changes/chg-001/task-plans/task-001:start",
      body: {},
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "task-001", status: "IN_PROGRESS" }, 200),
    );

    await controller.proxy(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/changes/chg-001/task-plans/task-001:start",
      }),
    );
  });
});
