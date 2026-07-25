import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { UnauthorizedException } from "@nestjs/common";
import {
  AuthApiPaths,
  HttpHeader,
  LoginRequest,
} from "@design-platform/shared";
import { AuthProxyController } from "../../../../src/proxy/auth/auth-proxy.controller";
import type { ProxyService } from "../../../../src/proxy/proxy.service";
import type { CookieService } from "../../../../src/proxy/auth/cookie.service";
import { SchemaValidator } from "../../../../src/proxy/schema-validator.service";
import type { ProxyResult } from "../../../../src/interceptors/proxy.interceptor";

/** 构造 ProxyService mock */
function createProxyServiceMock(): ProxyService {
  return { forward: vi.fn() } as unknown as ProxyService;
}

/** 构造 CookieService mock，getRefreshTokenFromCookie 默认返回 refreshToken 参数 */
function createCookieServiceMock(
  refreshToken: string | null = null,
): CookieService {
  return {
    setRefreshTokenCookie: vi.fn(),
    clearRefreshTokenCookie: vi.fn(),
    getRefreshTokenFromCookie: vi.fn().mockReturnValue(refreshToken),
  } as unknown as CookieService;
}

/** 构造真实 SchemaValidator（无依赖服务，直接实例化） */
function createSchemaValidator(): SchemaValidator {
  return new SchemaValidator();
}

/** 构造 Express Request mock */
function createRequest(headers: Record<string, string> = {}): Request {
  const headersLower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    method: "POST",
    url: "/api/v1/auth/login",
    traceId: "test-trace-id-123",
    header: vi.fn((name: string) => headersLower[name.toLowerCase()]),
    headers: headersLower,
  } as unknown as Request;
}

/** 构造 Express Response mock */
function createResponse(): Response {
  return {
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

/** 构造 ProxyResult */
function createProxyResult<T>(data: T, status = 200): ProxyResult {
  return { status, data, headers: {} };
}

/** 合法的登录响应 fixture（符合 loginResponseSchema） */
const validLoginResponse = {
  principal: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    tenantId: "550e8400-e29b-41d4-a716-446655440001",
    email: "user@example.com",
    displayName: "张三",
    type: "user",
    status: "active",
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
  },
  accessToken: "access-token-xyz",
  accessTokenExpiresIn: 900,
  refreshTokenSet: true,
  tenant: {
    id: "550e8400-e29b-41d4-a716-446655440001",
    name: "Acme Inc.",
    code: "ACME",
    region: "CN",
    language: "zh",
  },
  roles: ["architect"],
  permissions: ["project:read"],
  refreshToken: "refresh-token-xyz",
};

/** 合法的 refresh 响应 fixture（符合 refreshTokenResponseSchema） */
const validRefreshResponse = {
  accessToken: "new-access-token",
  accessTokenExpiresIn: 900,
  refreshTokenSet: true,
  refreshToken: "new-refresh-token",
};

/** 构造 controller + 三个 mock/real 服务的组合 */
function createController(refreshToken: string | null = null) {
  const proxyService = createProxyServiceMock();
  const cookieService = createCookieServiceMock(refreshToken);
  const schemaValidator = createSchemaValidator();
  return {
    controller: new AuthProxyController(
      proxyService,
      cookieService,
      schemaValidator,
    ),
    proxyService,
    cookieService,
    schemaValidator,
  };
}

describe("AuthProxyController", () => {
  describe("login", () => {
    it("应该转发到 login 端点并在响应含 refreshToken 时写入 Cookie 且从响应删除 refreshToken", async () => {
      // Arrange
      const { controller, proxyService, cookieService } = createController();
      const request = createRequest({
        [HttpHeader.X_TENANT_ID]: "tenant-1",
        [HttpHeader.X_TRACE_ID]: "test-trace-id-123",
      });
      const response = createResponse();
      const body: LoginRequest = {
        email: "user@example.com",
        password: "Passw0rd!",
      };
      vi.mocked(proxyService.forward).mockResolvedValue(
        createProxyResult({ ...validLoginResponse }),
      );

      // Act
      const result = await controller.login(request, body, response);

      // Assert：转发请求
      expect(proxyService.forward).toHaveBeenCalledWith({
        method: "POST",
        path: AuthApiPaths.login,
        body,
        headers: expect.objectContaining({
          [HttpHeader.X_TENANT_ID]: "tenant-1",
          [HttpHeader.X_TRACE_ID]: "test-trace-id-123",
        }),
      });
      // Assert：写入 cookie
      expect(cookieService.setRefreshTokenCookie).toHaveBeenCalledWith(
        response,
        "refresh-token-xyz",
      );
      // Assert：响应体中的 refreshToken 已被删除（避免泄露给浏览器）
      expect(
        (result.data as { refreshToken?: string }).refreshToken,
      ).toBeUndefined();
    });

    it("在响应不含 refreshToken 时不应写入 Cookie", async () => {
      // Arrange
      const { controller, proxyService, cookieService } = createController();
      const request = createRequest();
      const response = createResponse();
      const body: LoginRequest = {
        email: "user@example.com",
        password: "Passw0rd!",
      };
      const { refreshToken: _omit, ...responseWithoutRefresh } =
        validLoginResponse;
      vi.mocked(proxyService.forward).mockResolvedValue(
        createProxyResult(responseWithoutRefresh),
      );

      // Act
      await controller.login(request, body, response);

      // Assert
      expect(cookieService.setRefreshTokenCookie).not.toHaveBeenCalled();
    });

    it("契约验证失败时应抛 BadGatewayException（502）— 防止前端拿到残缺的 token 字段", async () => {
      // Arrange：缺少 accessToken 字段的响应
      const { controller, proxyService } = createController();
      const request = createRequest();
      const response = createResponse();
      const body: LoginRequest = {
        email: "user@example.com",
        password: "Passw0rd!",
      };
      const brokenData = { ...validLoginResponse, accessToken: "" };
      vi.mocked(proxyService.forward).mockResolvedValue(
        createProxyResult(brokenData),
      );

      // Act + Assert
      await expect(
        controller.login(request, body, response),
      ).rejects.toMatchObject({
        status: 502,
        response: expect.objectContaining({
          errorCode: "CONTRACT_VALIDATION_FAILED",
        }),
      });
    });
  });

  describe("refresh", () => {
    it("应该从 Cookie 读取 refresh token 并转发到 refresh 端点，随后写入新 Cookie", async () => {
      // Arrange
      const { controller, proxyService, cookieService } =
        createController("old-refresh-token");
      const request = createRequest({ [HttpHeader.X_TENANT_ID]: "tenant-1" });
      const response = createResponse();
      const body = { allDevices: false };
      vi.mocked(proxyService.forward).mockResolvedValue(
        createProxyResult({ ...validRefreshResponse }),
      );

      // Act
      const result = await controller.refresh(request, body, response);

      // Assert：从 cookie 读取 refresh token
      expect(cookieService.getRefreshTokenFromCookie).toHaveBeenCalledWith(
        request,
      );
      // Assert：转发请求体中携带 refreshToken
      expect(proxyService.forward).toHaveBeenCalledWith({
        method: "POST",
        path: AuthApiPaths.refresh,
        body: { ...body, refreshToken: "old-refresh-token" },
        headers: expect.objectContaining({
          [HttpHeader.X_TRACE_ID]: "test-trace-id-123",
        }),
      });
      // Assert：rotation — 写入新的 cookie
      expect(cookieService.setRefreshTokenCookie).toHaveBeenCalledWith(
        response,
        "new-refresh-token",
      );
      // Assert：响应体中 refreshToken 已删除
      expect(
        (result.data as { refreshToken?: string }).refreshToken,
      ).toBeUndefined();
    });

    it("在 Cookie 中无 refresh token 时应抛出 UnauthorizedException 且不调用下游", async () => {
      // Arrange
      const { controller, proxyService } = createController(null);
      const request = createRequest();
      const response = createResponse();

      // Act & Assert
      await expect(controller.refresh(request, {}, response)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(proxyService.forward).not.toHaveBeenCalled();
    });

    it("契约验证失败时应抛 BadGatewayException — refresh 响应必须含 accessToken", async () => {
      // Arrange：缺少 accessToken 字段
      const { controller, proxyService } =
        createController("old-refresh-token");
      const request = createRequest();
      const response = createResponse();
      const brokenData = { accessTokenExpiresIn: 900, refreshTokenSet: true };
      vi.mocked(proxyService.forward).mockResolvedValue(
        createProxyResult(brokenData),
      );

      // Act + Assert
      await expect(
        controller.refresh(request, {}, response),
      ).rejects.toMatchObject({
        status: 502,
      });
    });
  });

  describe("logout", () => {
    it("应该转发到 logout 端点（请求体含 refreshToken）并清除 Cookie", async () => {
      // Arrange
      const { controller, proxyService, cookieService } = createController(
        "existing-refresh-token",
      );
      const request = createRequest();
      const response = createResponse();
      const body = { allDevices: false };
      vi.mocked(proxyService.forward).mockResolvedValue(
        createProxyResult({ revoked: true }),
      );

      // Act
      const result = await controller.logout(request, response, body);

      // Assert
      expect(proxyService.forward).toHaveBeenCalledWith({
        method: "POST",
        path: AuthApiPaths.logout,
        body: { ...body, refreshToken: "existing-refresh-token" },
        headers: expect.objectContaining({
          [HttpHeader.X_TRACE_ID]: "test-trace-id-123",
        }),
      });
      expect(cookieService.clearRefreshTokenCookie).toHaveBeenCalledWith(
        response,
      );
      expect(result.data).toEqual({ revoked: true });
    });

    it("在 Cookie 中无 refresh token 时也应正常登出且 refreshToken 为 undefined", async () => {
      // Arrange
      const { controller, proxyService, cookieService } =
        createController(null);
      const request = createRequest();
      const response = createResponse();
      vi.mocked(proxyService.forward).mockResolvedValue(
        createProxyResult({ revoked: true }),
      );

      // Act
      await controller.logout(request, response, {});

      // Assert：refreshToken 字段为 undefined（不阻断登出）
      expect(proxyService.forward).toHaveBeenCalledWith({
        method: "POST",
        path: AuthApiPaths.logout,
        body: { refreshToken: undefined },
        headers: expect.any(Object),
      });
      // Assert：仍然清除 cookie（幂等）
      expect(cookieService.clearRefreshTokenCookie).toHaveBeenCalledWith(
        response,
      );
    });
  });

  describe("me 与 changePassword", () => {
    it("me 应该转发到 GET /auth/me 并透传 Authorization/x-trace-id 头", async () => {
      // Arrange
      const { controller, proxyService } = createController();
      const request = createRequest({
        [HttpHeader.AUTHORIZATION]: "Bearer access-token",
      });
      vi.mocked(proxyService.forward).mockResolvedValue(
        createProxyResult({ id: "p1" }),
      );

      // Act
      await controller.me(request);

      // Assert
      expect(proxyService.forward).toHaveBeenCalledWith({
        method: "GET",
        path: AuthApiPaths.me,
        headers: expect.objectContaining({
          [HttpHeader.AUTHORIZATION]: "Bearer access-token",
          [HttpHeader.X_TRACE_ID]: "test-trace-id-123",
        }),
      });
    });

    it("changePassword 应该转发到 POST /auth/change-password 并透传 Authorization 头与请求体", async () => {
      // Arrange
      const { controller, proxyService } = createController();
      const request = createRequest({
        [HttpHeader.AUTHORIZATION]: "Bearer access-token",
      });
      const body = {
        currentPassword: "OldPassw0rd!",
        newPassword: "NewPassw0rd!",
      };
      vi.mocked(proxyService.forward).mockResolvedValue(
        createProxyResult({ ok: true }),
      );

      // Act
      await controller.changePassword(request, body);

      // Assert
      expect(proxyService.forward).toHaveBeenCalledWith({
        method: "POST",
        path: AuthApiPaths.changePassword,
        body,
        headers: expect.objectContaining({
          [HttpHeader.AUTHORIZATION]: "Bearer access-token",
        }),
      });
    });
  });
});
