import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { CookieService } from "../../../../src/proxy/auth/cookie.service";

/** refresh token Cookie 名称（与源码保持一致） */
const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

/** 构造 ConfigService mock */
function createConfigService(
  environment: string = "development",
): ConfigService {
  return {
    get: vi.fn((key: string) => {
      if (key === "app.environment") {
        return environment;
      }
      return undefined;
    }),
  } as unknown as ConfigService;
}

/** 构造 Express Response mock，记录 cookie 调用 */
function createResponse(): Response & {
  __cookieCalls: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }>;
  __clearCookieCalls: Array<{ name: string; options: Record<string, unknown> }>;
} {
  const cookieCalls: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];
  const clearCookieCalls: Array<{
    name: string;
    options: Record<string, unknown>;
  }> = [];
  return {
    cookie: vi.fn(
      (name: string, value: string, options: Record<string, unknown>) => {
        cookieCalls.push({ name, value, options });
        return this as unknown as Response;
      },
    ),
    clearCookie: vi.fn((name: string, options: Record<string, unknown>) => {
      clearCookieCalls.push({ name, options });
      return this as unknown as Response;
    }),
    __cookieCalls: cookieCalls,
    __clearCookieCalls: clearCookieCalls,
  } as unknown as Response & {
    __cookieCalls: typeof cookieCalls;
    __clearCookieCalls: typeof clearCookieCalls;
  };
}

/** 构造 Express Request mock */
function createRequest(
  cookieHeader?: string,
  cookies?: Record<string, string>,
): Request {
  return {
    headers: cookieHeader !== undefined ? { cookie: cookieHeader } : {},
    cookies,
  } as unknown as Request;
}

describe("CookieService", () => {
  describe("setRefreshTokenCookie", () => {
    it("应该设置 httpOnly + sameSite=strict + path=/api/v1/auth 的 cookie", () => {
      // Arrange
      const configService = createConfigService("development");
      const cookieService = new CookieService(configService);
      const response = createResponse();

      // Act
      cookieService.setRefreshTokenCookie(response, "test-refresh-token");

      // Assert
      expect(response.__cookieCalls).toHaveLength(1);
      const call = response.__cookieCalls[0]!;
      expect(call.name).toBe(REFRESH_TOKEN_COOKIE_NAME);
      expect(call.value).toBe("test-refresh-token");
      expect(call.options.httpOnly).toBe(true);
      expect(call.options.sameSite).toBe("strict");
      expect(call.options.path).toBe("/api/v1/auth");
    });

    it("在开发环境应该将 secure 设为 false", () => {
      // Arrange
      const configService = createConfigService("development");
      const cookieService = new CookieService(configService);
      const response = createResponse();

      // Act
      cookieService.setRefreshTokenCookie(response, "token");

      // Assert
      expect(response.__cookieCalls[0]!.options.secure).toBe(false);
    });

    it("在生产环境应该将 secure 设为 true", () => {
      // Arrange
      const configService = createConfigService("production");
      const cookieService = new CookieService(configService);
      const response = createResponse();

      // Act
      cookieService.setRefreshTokenCookie(response, "token");

      // Assert
      expect(response.__cookieCalls[0]!.options.secure).toBe(true);
    });

    it("应该使用默认 maxAge 为 7 天（毫秒）", () => {
      // Arrange
      const configService = createConfigService("development");
      const cookieService = new CookieService(configService);
      const response = createResponse();

      // Act
      cookieService.setRefreshTokenCookie(response, "token");

      // Assert：7 天 = 7 * 24 * 60 * 60 * 1000
      expect(response.__cookieCalls[0]!.options.maxAge).toBe(
        7 * 24 * 60 * 60 * 1000,
      );
    });

    it("应该支持自定义 maxAge", () => {
      // Arrange
      const configService = createConfigService("development");
      const cookieService = new CookieService(configService);
      const response = createResponse();

      // Act
      cookieService.setRefreshTokenCookie(response, "token", 60_000);

      // Assert
      expect(response.__cookieCalls[0]!.options.maxAge).toBe(60_000);
    });
  });

  describe("clearRefreshTokenCookie", () => {
    it("应该调用 clearCookie 并复用相同 path 与安全选项", () => {
      // Arrange
      const configService = createConfigService("production");
      const cookieService = new CookieService(configService);
      const response = createResponse();

      // Act
      cookieService.clearRefreshTokenCookie(response);

      // Assert
      expect(response.__clearCookieCalls).toHaveLength(1);
      const call = response.__clearCookieCalls[0]!;
      expect(call.name).toBe(REFRESH_TOKEN_COOKIE_NAME);
      expect(call.options.httpOnly).toBe(true);
      expect(call.options.secure).toBe(true);
      expect(call.options.sameSite).toBe("strict");
      expect(call.options.path).toBe("/api/v1/auth");
    });
  });

  describe("getRefreshTokenFromCookie", () => {
    it("应该优先使用 cookie-parser 解析结果", () => {
      // Arrange
      const configService = createConfigService("development");
      const cookieService = new CookieService(configService);
      const request = createRequest("refresh_token=fallback", {
        refresh_token: "parsed-token",
      });

      // Act
      const token = cookieService.getRefreshTokenFromCookie(request);

      // Assert
      expect(token).toBe("parsed-token");
    });

    it("应该回退到手动解析 Cookie header", () => {
      // Arrange
      const configService = createConfigService("development");
      const cookieService = new CookieService(configService);
      const request = createRequest("refresh_token=manual-token; theme=dark");

      // Act
      const token = cookieService.getRefreshTokenFromCookie(request);

      // Assert
      expect(token).toBe("manual-token");
    });

    it("应该在 Cookie header 不存在时返回 null", () => {
      // Arrange
      const configService = createConfigService("development");
      const cookieService = new CookieService(configService);
      const request = createRequest(undefined);

      // Act
      const token = cookieService.getRefreshTokenFromCookie(request);

      // Assert
      expect(token).toBeNull();
    });

    it("应该在 Cookie header 为空字符串时返回 null", () => {
      // Arrange
      const configService = createConfigService("development");
      const cookieService = new CookieService(configService);
      const request = createRequest("");

      // Act
      const token = cookieService.getRefreshTokenFromCookie(request);

      // Assert
      expect(token).toBeNull();
    });

    it("应该在 refresh_token cookie 缺失时返回 null", () => {
      // Arrange
      const configService = createConfigService("development");
      const cookieService = new CookieService(configService);
      const request = createRequest("theme=dark; lang=zh");

      // Act
      const token = cookieService.getRefreshTokenFromCookie(request);

      // Assert
      expect(token).toBeNull();
    });

    it("应该正确解码 URL 编码的 refresh token", () => {
      // Arrange
      const configService = createConfigService("development");
      const cookieService = new CookieService(configService);
      const encodedValue = encodeURIComponent("token-with-special-chars+/=");
      const request = createRequest(`refresh_token=${encodedValue}`);

      // Act
      const token = cookieService.getRefreshTokenFromCookie(request);

      // Assert
      expect(token).toBe("token-with-special-chars+/=");
    });

    it("应该在多 cookie 中正确提取 refresh_token", () => {
      // Arrange
      const configService = createConfigService("development");
      const cookieService = new CookieService(configService);
      const request = createRequest(
        "theme=dark; refresh_token=target-token; lang=zh",
      );

      // Act
      const token = cookieService.getRefreshTokenFromCookie(request);

      // Assert
      expect(token).toBe("target-token");
    });
  });
});
