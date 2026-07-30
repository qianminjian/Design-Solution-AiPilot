import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { HttpHeader } from "@design-platform/shared";

/**
 * 认证 token 透传中间件
 *
 * 背景：
 * - security.md §2.2 要求 access token 存 httpOnly Cookie，禁止 localStorage
 * - 前端 JS 无法读取 httpOnly Cookie，因此无法显式设置 Authorization 头
 * - 浏览器同源请求会自动携带 Cookie 到 BFF，但 BFF 转发到 Core Service 时
 *   需要显式 Authorization 头（Core Service 端 JwtAuthenticationFilter 解析 Bearer token）
 *
 * 职责：
 * 1. 从 Cookie 中读取 access_token，注入到 request.headers.authorization
 *    （仅当请求头未携带 Authorization 时，避免覆盖前端显式传入的场景）
 * 2. 从 Cookie 中读取 tenant_id，注入到 request.headers['x-tenant-id']
 *    （仅当请求头未携带 x-tenant-id 时）
 *
 * 跳过路径：
 * - /api/v1/auth/login：登录前无 token
 * - /api/v1/auth/refresh：使用 refresh token，不走 access token
 * - /api/v1/auth/logout：登出时不校验 access token
 * - /api/v1/health、/api/v1/metrics：健康检查与指标端点
 *
 * 权威源：@design/D39-身份多租户-授权.md §D39.7、security.md §2.2
 */
@Injectable()
export class AuthTokenMiddleware implements NestMiddleware {
  private static readonly SKIP_PATH_PATTERNS = [
    /^\/api\/v1\/auth\/login$/,
    /^\/api\/v1\/auth\/refresh$/,
    /^\/api\/v1\/auth\/logout$/,
    /^\/api\/v1\/health/,
    /^\/api\/v1\/metrics/,
  ];

  use(request: Request, _response: Response, next: NextFunction): void {
    if (this.shouldSkip(request.path)) {
      next();
      return;
    }

    // 注入 Authorization 头（若未显式携带）
    if (!request.header(HttpHeader.AUTHORIZATION)) {
      const accessToken = this.readCookie(request, "access_token");
      if (accessToken) {
        request.headers[HttpHeader.AUTHORIZATION] = `Bearer ${accessToken}`;
      }
    }

    // 注入 x-tenant-id 头（若未显式携带）
    if (!request.header(HttpHeader.X_TENANT_ID)) {
      const tenantId = this.readCookie(request, "tenant_id");
      if (tenantId) {
        request.headers[HttpHeader.X_TENANT_ID] = tenantId;
      }
    }

    next();
  }

  /**
   * 判断是否跳过该路径的认证注入
   */
  private shouldSkip(path: string): boolean {
    return AuthTokenMiddleware.SKIP_PATH_PATTERNS.some((pattern) =>
      pattern.test(path),
    );
  }

  /**
   * 从 Cookie header 中读取指定名称的值
   * 不依赖 cookie-parser，自行解析
   */
  private readCookie(request: Request, name: string): string | null {
    const cookieHeader = request.headers.cookie;
    if (typeof cookieHeader !== "string" || cookieHeader.length === 0) {
      return null;
    }

    for (const pair of cookieHeader.split(";")) {
      const trimmed = pair.trim();
      if (trimmed.length === 0) continue;
      const equalIndex = trimmed.indexOf("=");
      if (equalIndex <= 0) continue;
      const key = trimmed.slice(0, equalIndex).trim();
      if (key !== name) continue;
      const value = trimmed.slice(equalIndex + 1).trim();
      if (value.length === 0) return null;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
    return null;
  }
}
