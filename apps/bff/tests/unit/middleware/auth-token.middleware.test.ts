import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { HttpHeader } from "@design-platform/shared";
import { AuthTokenMiddleware } from "../../../src/middleware/auth-token.middleware";

/**
 * 构造 Express Request mock
 * - headers：原始头键值（小写键）
 * - header(name)：返回对应请求头
 * - path：请求路径
 * - cookies：可选，模拟 cookie-parser 解析结果
 */
function createRequest(options: {
  headers?: Record<string, string>;
  cookie?: string;
  path?: string;
}): Request {
  const headers: Record<string, string> = {};
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headers[k.toLowerCase()] = v;
    }
  }
  if (options.cookie !== undefined) {
    headers["cookie"] = options.cookie;
  }
  return {
    header: vi.fn((name: string) => headers[name.toLowerCase()]),
    headers,
    path: options.path ?? "/api/v1/projects",
    method: "GET",
  } as unknown as Request;
}

function createNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

function createResponse(): Response {
  return {} as unknown as Response;
}

describe("AuthTokenMiddleware", () => {
  it("应该从 Cookie 中提取 access_token 并注入 Authorization 头", () => {
    // Arrange
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      cookie: "access_token=jwt-token-xyz; tenant_id=tenant-001",
    });
    const response = createResponse();
    const next = createNext();

    // Act
    middleware.use(request, response, next);

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
    expect(request.header(HttpHeader.AUTHORIZATION)).toBe(
      "Bearer jwt-token-xyz",
    );
    expect(request.header(HttpHeader.X_TENANT_ID)).toBe("tenant-001");
  });

  it("应该跳过 /api/v1/auth/login 路径（登录前无 token）", () => {
    // Arrange
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      path: "/api/v1/auth/login",
      cookie: "access_token=jwt-token-xyz",
    });
    const response = createResponse();
    const next = createNext();

    // Act
    middleware.use(request, response, next);

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
    // 不应注入 Authorization
    expect(request.header(HttpHeader.AUTHORIZATION)).toBeUndefined();
  });

  it("应该跳过 /api/v1/auth/refresh 路径", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      path: "/api/v1/auth/refresh",
      cookie: "access_token=jwt-token-xyz",
    });
    const response = createResponse();
    const next = createNext();

    middleware.use(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.header(HttpHeader.AUTHORIZATION)).toBeUndefined();
  });

  it("应该跳过 /api/v1/auth/logout 路径", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      path: "/api/v1/auth/logout",
      cookie: "access_token=jwt-token-xyz",
    });
    const response = createResponse();
    const next = createNext();

    middleware.use(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.header(HttpHeader.AUTHORIZATION)).toBeUndefined();
  });

  it("应该跳过 /api/v1/health 健康检查路径", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      path: "/api/v1/health/live",
      cookie: "access_token=jwt-token-xyz",
    });
    const response = createResponse();
    const next = createNext();

    middleware.use(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.header(HttpHeader.AUTHORIZATION)).toBeUndefined();
  });

  it("应该跳过 /api/v1/metrics 指标端点", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      path: "/api/v1/metrics",
      cookie: "access_token=jwt-token-xyz",
    });
    const response = createResponse();
    const next = createNext();

    middleware.use(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.header(HttpHeader.AUTHORIZATION)).toBeUndefined();
  });

  it("Cookie 不存在 access_token 时不应注入 Authorization 头", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      cookie: "tenant_id=tenant-001",
    });
    const response = createResponse();
    const next = createNext();

    middleware.use(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.header(HttpHeader.AUTHORIZATION)).toBeUndefined();
  });

  it("Cookie 不存在 tenant_id 时不应注入 x-tenant-id 头", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      cookie: "access_token=jwt-token-xyz",
    });
    const response = createResponse();
    const next = createNext();

    middleware.use(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.header(HttpHeader.AUTHORIZATION)).toBe(
      "Bearer jwt-token-xyz",
    );
    expect(request.header(HttpHeader.X_TENANT_ID)).toBeUndefined();
  });

  it("请求头已携带 Authorization 时不应被 Cookie 覆盖", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      headers: { [HttpHeader.AUTHORIZATION]: "Bearer explicit-token" },
      cookie: "access_token=cookie-token",
    });
    const response = createResponse();
    const next = createNext();

    middleware.use(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.header(HttpHeader.AUTHORIZATION)).toBe(
      "Bearer explicit-token",
    );
  });

  it("请求头已携带 x-tenant-id 时不应被 Cookie 覆盖", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      headers: { [HttpHeader.X_TENANT_ID]: "explicit-tenant" },
      cookie: "tenant_id=cookie-tenant",
    });
    const response = createResponse();
    const next = createNext();

    middleware.use(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.header(HttpHeader.X_TENANT_ID)).toBe("explicit-tenant");
  });

  it("应该正确处理 URL 编码的 Cookie 值", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      cookie: "access_token=jwt%20token%20with%20spaces",
    });
    const response = createResponse();
    const next = createNext();

    middleware.use(request, response, next);

    expect(request.header(HttpHeader.AUTHORIZATION)).toBe(
      "Bearer jwt token with spaces",
    );
  });

  it("Cookie header 为空字符串时不应注入任何头", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      cookie: "",
    });
    const response = createResponse();
    const next = createNext();

    middleware.use(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.header(HttpHeader.AUTHORIZATION)).toBeUndefined();
    expect(request.header(HttpHeader.X_TENANT_ID)).toBeUndefined();
  });

  it("Cookie 中 access_token 值为空时不应注入 Authorization 头", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      cookie: "access_token=; tenant_id=tenant-001",
    });
    const response = createResponse();
    const next = createNext();

    middleware.use(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.header(HttpHeader.AUTHORIZATION)).toBeUndefined();
    expect(request.header(HttpHeader.X_TENANT_ID)).toBe("tenant-001");
  });

  it("Cookie header 不存在时不应抛错", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({});
    const response = createResponse();
    const next = createNext();

    expect(() => middleware.use(request, response, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("应该支持多个 Cookie 用分号分隔", () => {
    const middleware = new AuthTokenMiddleware();
    const request = createRequest({
      cookie:
        "access_token=token-abc; tenant_id=tenant-xyz; other_cookie=value",
    });
    const response = createResponse();
    const next = createNext();

    middleware.use(request, response, next);

    expect(request.header(HttpHeader.AUTHORIZATION)).toBe("Bearer token-abc");
    expect(request.header(HttpHeader.X_TENANT_ID)).toBe("tenant-xyz");
  });
});
