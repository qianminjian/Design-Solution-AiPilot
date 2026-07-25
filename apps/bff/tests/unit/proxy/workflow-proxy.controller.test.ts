import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { WorkflowProxyController } from "../../../src/proxy/workflow/workflow-proxy.controller";
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
    originalUrl: "/api/v1/workflow/stages",
    url: "/api/v1/workflow/stages",
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

/** 合法的阶段实例 fixture（符合 stageInstanceDtoSchema） */
const validStageInstance = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  tenantId: "550e8400-e29b-41d4-a716-446655440001",
  projectId: "550e8400-e29b-41d4-a716-446655440002",
  stageCode: "STG-P2" as const,
  stageName: "方案设计",
  stageOrder: 2,
  status: "active" as const,
  startedAt: "2026-07-25T10:00:00.000Z",
  completedAt: null,
  metadata: {},
  createdAt: "2026-07-25T09:00:00.000Z",
  updatedAt: "2026-07-25T09:00:00.000Z",
  rowVersion: 1,
};

/** 合法的门禁决策 fixture（符合 gateDecisionDtoSchema） */
const validGateDecision = {
  id: "550e8400-e29b-41d4-a716-446655440020",
  tenantId: "550e8400-e29b-41d4-a716-446655440001",
  projectId: "550e8400-e29b-41d4-a716-446655440002",
  stageId: "550e8400-e29b-41d4-a716-446655440010",
  gateCode: "G2" as const,
  gateName: "方案评审",
  status: "decided" as const,
  decision: "approved" as const,
  decidedAt: "2026-07-25T11:00:00.000Z",
  decidedBy: "550e8400-e29b-41d4-a716-446655440003",
  baselineId: null,
  comment: "通过方案评审",
  evidence: [],
  metadata: {},
  createdAt: "2026-07-25T09:30:00.000Z",
  updatedAt: "2026-07-25T11:00:00.000Z",
  rowVersion: 1,
};

/** 合法的项目基线 fixture（符合 projectBaselineDtoSchema） */
const validProjectBaseline = {
  id: "550e8400-e29b-41d4-a716-446655440030",
  tenantId: "550e8400-e29b-41d4-a716-446655440001",
  projectId: "550e8400-e29b-41d4-a716-446655440002",
  revisionNo: 1,
  name: "方案基线 v1",
  status: "frozen" as const,
  frozenAt: "2026-07-25T12:00:00.000Z",
  frozenBy: "550e8400-e29b-41d4-a716-446655440003",
  description: "方案阶段冻结基线",
  metadata: {},
  createdAt: "2026-07-25T09:00:00.000Z",
  updatedAt: "2026-07-25T12:00:00.000Z",
  rowVersion: 1,
};

describe("WorkflowProxyController", () => {
  it("POST /stages/:id:transition 软验证通过时应写回验证后的数据", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new WorkflowProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl:
        "/api/v1/workflow/stages/550e8400-e29b-41d4-a716-446655440010:transition",
      body: { targetStatus: "active", comment: "启动方案阶段" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ...validStageInstance }),
    );

    const result = await controller.proxy(request);

    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({
      stageCode: "STG-P2",
      status: "active",
    });
  });

  it("POST /stages/:id:transition 软验证失败时应保持原数据透传（不阻断）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new WorkflowProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl:
        "/api/v1/workflow/stages/550e8400-e29b-41d4-a716-446655440010:transition",
      body: {},
    });
    // 缺失 stageCode 字段
    const brokenResponse = { ...validStageInstance, stageCode: undefined };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(brokenResponse),
    );

    const result = await controller.proxy(request);

    // 软验证不阻断，原数据透传
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject(brokenResponse);
  });

  it("POST /gates/:id:decide 应做软验证（gateDecisionDtoSchema）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new WorkflowProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl:
        "/api/v1/workflow/gates/550e8400-e29b-41d4-a716-446655440020:decide",
      body: { decision: "approved", comment: "通过评审" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ...validGateDecision }),
    );

    const result = await controller.proxy(request);

    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ decision: "approved" });
  });

  it("POST /baselines/:id:freeze 应做软验证（projectBaselineDtoSchema）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new WorkflowProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl:
        "/api/v1/workflow/baselines/550e8400-e29b-41d4-a716-446655440030:freeze",
      body: { name: "方案基线 v1" },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ...validProjectBaseline }),
    );

    const result = await controller.proxy(request);

    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ status: "frozen" });
  });

  it("GET /baselines/:id 详情应做软验证（projectBaselineDtoSchema）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new WorkflowProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl:
        "/api/v1/workflow/baselines/550e8400-e29b-41d4-a716-446655440030",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ...validProjectBaseline }),
    );

    const result = await controller.proxy(request);

    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ status: "frozen" });
  });

  it("GET /baselines 列表响应（数组）应跳过单实体 schema 验证", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new WorkflowProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl:
        "/api/v1/workflow/baselines?projectId=550e8400-e29b-41d4-a716-446655440002",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult([
        { ...validProjectBaseline },
        { ...validProjectBaseline, revisionNo: 0 },
      ]),
    );

    const result = await controller.proxy(request);

    expect(result.status).toBe(200);
    // 列表响应保持原样
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it("不匹配的路径应不做 schema 验证（直接透传）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new WorkflowProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl:
        "/api/v1/workflow/stages?projectId=550e8400-e29b-41d4-a716-446655440002",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult([{ ...validStageInstance }]),
    );

    const result = await controller.proxy(request);

    expect(result.status).toBe(200);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it("非 2xx 状态码响应应直接透传，不触发软验证", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new WorkflowProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl:
        "/api/v1/workflow/stages/550e8400-e29b-41d4-a716-446655440010:transition",
      body: {},
    });
    const errorResponse = {
      errorCode: "STAGE_TRANSITION_INVALID",
      message: "无法从当前状态流转",
    };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(errorResponse, 409),
    );

    const result = await controller.proxy(request);

    expect(result.status).toBe(409);
    expect(result.data).toEqual(errorResponse);
  });

  it("POST 请求应该转发 body，GET 请求应该不携带 body", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new WorkflowProxyController(
      proxyService,
      schemaValidator,
    );
    const requestBody = { targetStatus: "active", comment: "启动" };
    const request = createRequest({
      method: "POST",
      originalUrl:
        "/api/v1/workflow/stages/550e8400-e29b-41d4-a716-446655440010:transition",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ...validStageInstance }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.body).toEqual(requestBody);
  });

  it("应该转发授权头与租户头", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new WorkflowProxyController(
      proxyService,
      schemaValidator,
    );
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
      originalUrl:
        "/api/v1/workflow/stages/550e8400-e29b-41d4-a716-446655440010:transition",
      body: {},
      header: headerMock,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ...validStageInstance }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
      "x-user-id": "user-001",
    });
  });

  it("应该在请求头未携带 traceId 时使用 request.traceId 兜底", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new WorkflowProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl:
        "/api/v1/workflow/stages/550e8400-e29b-41d4-a716-446655440010:transition",
      body: {},
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ ...validStageInstance }),
    );

    await controller.proxy(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe("fallback-trace-id");
  });

  it("应该兼容 ApiResponse<T> 包装格式（Java Core Service）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new WorkflowProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl:
        "/api/v1/workflow/stages/550e8400-e29b-41d4-a716-446655440010:transition",
      body: {},
    });
    const wrappedResponse = {
      code: 0,
      data: { ...validStageInstance },
      message: "success",
      traceId: "trace-001",
    };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(wrappedResponse),
    );

    const result = await controller.proxy(request);

    expect(result.status).toBe(200);
    const data = result.data as { code: number; data: unknown };
    expect(data.code).toBe(0);
    expect(data.data).toMatchObject({ stageCode: "STG-P2" });
  });
});
