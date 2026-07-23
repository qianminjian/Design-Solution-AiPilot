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

/** 构造 controller + 两个 mock 服务的组合 */
function createController(refreshToken: string | null = null) {
  const proxyService = createProxyServiceMock();
  const cookieService = createCookieServiceMock(refreshToken);
  return {
    controller: new AuthProxyController(proxyService, cookieService),
    proxyService,
    cookieService,
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
      // 下游返回带 refreshToken 的响应（结构简化，仅关注 refreshToken 字段）
      const downstreamData = {
        accessToken: "access-token-xyz",
        accessTokenExpiresIn: 900,
        refreshTokenSet: true,
        refreshToken: "refresh-token-xyz",
      };
      vi.mocked(proxyService.forward).mockResolvedValue(
        createProxyResult(downstreamData),
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
      vi.mocked(proxyService.forward).mockResolvedValue(
        createProxyResult({
          accessToken: "access-token",
          accessTokenExpiresIn: 900,
          refreshTokenSet: false,
        }),
      );

      // Act
      await controller.login(request, body, response);

      // Assert
      expect(cookieService.setRefreshTokenCookie).not.toHaveBeenCalled();
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
      const downstreamData = {
        accessToken: "new-access-token",
        accessTokenExpiresIn: 900,
        refreshTokenSet: true,
        refreshToken: "new-refresh-token",
      };
      vi.mocked(proxyService.forward).mockResolvedValue(
        createProxyResult(downstreamData),
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
