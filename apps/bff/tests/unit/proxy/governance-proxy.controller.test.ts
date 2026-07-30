import { describe, it, expect, vi } from "vitest";
import type { Request } from "express";
import { HttpHeader } from "@design-platform/shared";
import { GovernanceProxyController } from "../../../src/proxy/governance/governance-proxy.controller";
import { SchemaValidator } from "../../../src/proxy/schema-validator.service";
import type { ProxyService } from "../../../src/proxy/proxy.service";
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
    originalUrl: "/v1/access-grants",
    url: "/v1/access-grants",
    path: "/access-grants",
    query: {},
    body: undefined,
    traceId: "test-trace-id-gov-001",
    header: vi.fn(() => undefined),
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createProxyResult<T>(data: T, status = 200): ProxyResult {
  return { status, data, headers: {} };
}

describe("GovernanceProxyController", () => {
  it("GET /v1/access-grants 应该透传授权头与查询参数", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const headerMock = vi.fn((name: string) => {
      const map: Record<string, string> = {
        [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
        [HttpHeader.X_TENANT_ID]: "tenant-001",
        "x-user-id": "user-001",
      };
      return map[name];
    });
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/access-grants?status=active",
      query: { status: "active" },
      header: headerMock,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [], total: 0 }),
    );

    await controller.proxyAccessGrants(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/access-grants?status=active",
        query: { status: "active" },
      }),
    );
    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers).toMatchObject({
      [HttpHeader.AUTHORIZATION]: "Bearer token-xyz",
      [HttpHeader.X_TENANT_ID]: "tenant-001",
      "x-user-id": "user-001",
    });
    expect(callArgs.body).toBeUndefined();
  });

  it("POST /v1/releases/:id/promote 应该转发 body 与路径", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const requestBody = { reason: "评估通过，准予灰度提升", action: "promote" };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/releases/rel-001/promote",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "rel-001", status: "promoted" }, 200),
    );

    const result = await controller.proxyReleases(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/releases/rel-001/promote",
        body: requestBody,
      }),
    );
    expect(result.status).toBe(200);
  });

  it("DELETE /v1/access-grants/:id 应该透传（body 为 undefined）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "DELETE",
      originalUrl: "/v1/access-grants/grant-001",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "grant-001", status: "revoked" }, 200),
    );

    await controller.proxyAccessGrants(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.method).toBe("DELETE");
    expect(callArgs.body).toBeUndefined();
    expect(callArgs.path).toBe("/v1/access-grants/grant-001");
  });

  it("GET /v1/audit-logs 应该透传查询参数", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl:
        "/v1/audit-logs?category=governance&result=success&from=2026-07-01",
      query: {
        category: "governance",
        result: "success",
        from: "2026-07-01",
      },
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [], total: 0 }),
    );

    await controller.proxyAuditLogs(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        query: {
          category: "governance",
          result: "success",
          from: "2026-07-01",
        },
      }),
    );
  });

  it("POST /v1/backups 应该转发创建备份请求", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const requestBody = { type: "full", scope: "all", reason: "周备份" };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/backups",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "bk-001", status: "running" }, 202),
    );

    const result = await controller.proxyBackups(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: requestBody,
        path: "/v1/backups",
      }),
    );
    expect(result.status).toBe(202);
  });

  it("GET /v1/data-assets/:id/lineage 应该透传路径（无匹配 schema 规则，跳过验证）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/data-assets/asset-001/lineage",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ nodes: [], edges: [] }),
    );

    await controller.proxyDataAssets(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/data-assets/asset-001/lineage",
      }),
    );
  });

  it("POST /v1/evidence-packages/:id/verify 应该转发验证请求", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const requestBody = { action: "verify", verifier: "user-001" };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/evidence-packages/ep-001/verify",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "ep-001", status: "verified" }, 200),
    );

    await controller.proxyEvidencePackages(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: requestBody,
        path: "/v1/evidence-packages/ep-001/verify",
      }),
    );
  });

  it("POST /v1/restore-drills 应该转发创建演练请求", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const requestBody = {
      backupId: "bk-001",
      target: "isolated_env",
      operator: "user-001",
      stepUpToken: "stepup-token-xyz",
    };
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/restore-drills",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "dr-001", status: "running" }, 202),
    );

    await controller.proxyRestoreDrills(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        body: requestBody,
        path: "/v1/restore-drills",
      }),
    );
  });

  it("请求头未携带 traceId 时使用 request.traceId 兜底", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/access-grants",
      header: vi.fn(() => undefined),
      traceId: "fallback-trace-id-gov",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ items: [] }),
    );

    await controller.proxyAccessGrants(request);

    const callArgs = vi.mocked(proxyService.forward).mock.calls[0][0];
    expect(callArgs.headers[HttpHeader.X_TRACE_ID]).toBe(
      "fallback-trace-id-gov",
    );
  });

  it("非 2xx 状态码响应应直接透传（不阻断）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/releases/rel-001/rollback",
      body: { action: "rollback", reason: "指标漂移" },
    });
    const errorResponse = {
      errorCode: "STEP_UP_REQUIRED",
      message: "此操作需要 Step-up 认证",
    };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(errorResponse, 403),
    );

    const result = await controller.proxyReleases(request);

    expect(result.status).toBe(403);
    expect(result.data).toEqual(errorResponse);
  });

  it("PATCH /v1/access-grants/:id/shorten 应该转发 body", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const requestBody = {
      action: "shorten",
      reason: "缩短授权期限",
      newExpiresAt: "2026-08-01T00:00:00Z",
    };
    const request = createRequest({
      method: "PATCH",
      originalUrl: "/v1/access-grants/grant-001/shorten",
      body: requestBody,
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult({ id: "grant-001", status: "shortened" }, 200),
    );

    await controller.proxyAccessGrants(request);

    expect(proxyService.forward).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        body: requestBody,
        path: "/v1/access-grants/grant-001/shorten",
      }),
    );
  });

  // ── 软验证测试 ──

  it("GET /v1/access-grants 响应符合 schema 时软验证通过，不计数", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const validResponse = {
      items: [
        {
          id: "grant-001",
          type: "member",
          principalName: "张三",
          principalEmail: "zhang@example.com",
          resource: "project-001",
          permission: "READ",
          riskLevel: "low",
          status: "active",
          grantedBy: "admin",
          grantedAt: "2026-07-01T00:00:00Z",
          expiresAt: "2026-08-01T00:00:00Z",
          owner: "李四",
          ownerEmail: "li@example.com",
          reason: "项目需要",
          requiresStepUp: false,
        },
      ],
      total: 1,
    };
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/access-grants",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(validResponse),
    );

    await controller.proxyAccessGrants(request);

    const totals = schemaValidator.readFailureTotals();
    expect(totals.softTotal).toBe(0);
    expect(totals.strictTotal).toBe(0);
  });

  it("GET /v1/releases 响应缺失必填字段时软验证失败，计数 +1 但不阻断", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    // 缺失 evalScore、consumerCount 等必填字段
    const invalidResponse = {
      items: [
        {
          id: "rel-001",
          name: "测试 Release",
          type: "llm",
          version: "v1.0.0",
          status: "promoted",
          // 缺失：evalScore, evalSlices, redteamStatus, consumerCount, canaryPercent,
          //       metricsDrift, hasEvalGap, hasOldConsumer, description, diffSummary
          releaseManager: "admin",
          createdAt: "2026-07-01T00:00:00Z",
        },
      ],
      total: 1,
    };
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/releases",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(invalidResponse),
    );

    const result = await controller.proxyReleases(request);

    // 软验证不阻断，原数据透传
    expect(result.status).toBe(200);
    expect(result.data).toEqual(invalidResponse);

    // 失败计数 +1
    const totals = schemaValidator.readFailureTotals();
    expect(totals.softTotal).toBe(1);
  });

  it("GET /v1/backups/:id 响应符合 schema 时软验证通过", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const validBackup = {
      id: "bk-001",
      type: "full",
      scope: "all",
      startedAt: "2026-07-01T00:00:00Z",
      completedAt: "2026-07-01T01:00:00Z",
      durationSec: 3600,
      sizeBytes: 1024,
      objectCount: 100,
      status: "verified",
      actualRpoMin: 60,
      storageLocation: "s3://backup/bk-001",
      hash: "abc123",
      triggeredBy: "admin",
    };
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/backups/bk-001",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(validBackup),
    );

    await controller.proxyBackups(request);

    const totals = schemaValidator.readFailureTotals();
    expect(totals.softTotal).toBe(0);
  });

  it("GET /v1/audit-logs 响应字段类型错误时软验证失败计数", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    // riskLevel 不是合法枚举
    const invalidResponse = {
      items: [
        {
          id: "log-001",
          timestamp: "2026-07-01T00:00:00Z",
          actor: { id: "user-001", name: "张三", type: "user" },
          action: "login",
          category: "auth",
          object: { type: "session", id: "sess-001", name: "Session" },
          traceId: "trace-001",
          result: "success",
          riskLevel: "INVALID_ENUM", // 非法枚举值
          masked: false,
          ipAddress: "192.168.1.1",
          userAgent: "test-agent",
          details: "用户登录",
        },
      ],
      total: 1,
    };
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/audit-logs",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(invalidResponse),
    );

    const result = await controller.proxyAuditLogs(request);

    expect(result.status).toBe(200);
    const totals = schemaValidator.readFailureTotals();
    expect(totals.softTotal).toBe(1);
  });

  it("GET 子路径（如 /lineage）无匹配 schema 规则时跳过验证", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "GET",
      originalUrl: "/v1/data-assets/asset-001/lineage",
    });
    vi.mocked(proxyService.forward).mockResolvedValue(
      // 任意结构，无 schema 匹配，应跳过验证
      createProxyResult({ nodes: [{ id: "n1" }], edges: [] }),
    );

    await controller.proxyDataAssets(request);

    const totals = schemaValidator.readFailureTotals();
    expect(totals.softTotal).toBe(0);
  });

  it("POST 写操作不在 schema 规则中，跳过验证（写响应由 Core Service 保证）", async () => {
    const proxyService = createProxyServiceMock();
    const schemaValidator = createSchemaValidator();
    const controller = new GovernanceProxyController(
      proxyService,
      schemaValidator,
    );
    const request = createRequest({
      method: "POST",
      originalUrl: "/v1/releases/rel-001/promote",
      body: { action: "promote", reason: "通过" },
    });
    // POST 写响应不验证（schema 规则仅匹配 GET）
    const writeResponse = { success: true };
    vi.mocked(proxyService.forward).mockResolvedValue(
      createProxyResult(writeResponse, 200),
    );

    await controller.proxyReleases(request);

    const totals = schemaValidator.readFailureTotals();
    expect(totals.softTotal).toBe(0);
  });
});
