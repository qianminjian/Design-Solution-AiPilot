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
 * 3. A-61 P0-1 修复：从 JWT access_token 解析 principalId（sub），强制覆盖 x-user-id 头
 *    （无论客户端是否传入 x-user-id，BFF 都从 JWT 解析后覆盖，防止客户端伪造）
 *
 * 跳过路径：
 * - /api/v1/auth/login：登录前无 token
 * - /api/v1/auth/refresh：使用 refresh token，不走 access token
 * - /api/v1/auth/logout：登出时不校验 access token
 * - /api/v1/health、/api/v1/metrics：健康检查与指标端点
 *
 * 安全红线（A-61 P0-1 修复）：
 * - x-user-id 头不可被客户端伪造（任意已登录租户用户可冒充其他用户发起危险动作）
 * - BFF 必须从 JWT 解析 principalId 后强制覆盖 x-user-id 头
 * - Core Service 服务层应改读 SecurityContext（禁止读 x-user-id 头）
 *
 * 权威源：@design/D39-身份多租户-授权.md §D39.7、security.md §2.2、A-61 P0-1 审计修复
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
    let accessToken: string | null = null;
    if (!request.header(HttpHeader.AUTHORIZATION)) {
      accessToken = this.readCookie(request, "access_token");
      if (accessToken) {
        request.headers[HttpHeader.AUTHORIZATION] = `Bearer ${accessToken}`;
      }
    } else {
      const authHeader = request.header(HttpHeader.AUTHORIZATION) ?? "";
      if (authHeader.startsWith("Bearer ")) {
        accessToken = authHeader.slice(7);
      }
    }

    // 注入 x-tenant-id 头（若未显式携带）
    if (!request.header(HttpHeader.X_TENANT_ID)) {
      const tenantId = this.readCookie(request, "tenant_id");
      if (tenantId) {
        request.headers[HttpHeader.X_TENANT_ID] = tenantId;
      }
    }

    // A-61 P0-1 修复：从 JWT 解析 principalId，强制覆盖 x-user-id 头
    // 防止客户端伪造 x-user-id 头冒充其他用户发起危险动作（isolate/failover/cancel）
    if (accessToken) {
      const principalId = this.extractPrincipalIdFromJwt(accessToken);
      if (principalId) {
        // 强制覆盖：无论客户端是否传入 x-user-id，都使用 JWT 解析的 principalId
        request.headers[HttpHeader.X_USER_ID] = principalId;
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
   * 从 JWT access_token 中解析 principalId（sub claim）
   *
   * <p>仅解析 payload（不验证签名，签名验证由 Core Service JwtAuthenticationFilter 完成）。
   * BFF 端仅用于提取 principalId 注入 x-user-id 头，不作为认证依据。
   *
   * @param accessToken JWT access token 字符串
   * @returns principalId（UUID 字符串），解析失败返回 null
   */
  private extractPrincipalIdFromJwt(accessToken: string): string | null {
    try {
      const parts = accessToken.split(".");
      if (parts.length !== 3) {
        return null;
      }
      // JWT 第二部分为 payload（Base64Url 编码的 JSON）
      const payloadBase64 = parts[1];
      if (!payloadBase64) {
        return null;
      }
      // Base64Url → Base64（补齐 padding）
      const payloadBase64Standard = payloadBase64
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const padding = payloadBase64Standard.length % 4;
      const padded =
        padding === 0
          ? payloadBase64Standard
          : payloadBase64Standard + "=".repeat(4 - padding);
      const payloadJson = Buffer.from(padded, "base64").toString("utf-8");
      const payload = JSON.parse(payloadJson) as {
        sub?: string;
        principalId?: string;
      };
      // 兼容两种 claim 名：sub（标准 JWT）与 principalId（项目自定义）
      return payload.principalId ?? payload.sub ?? null;
    } catch {
      // 解析失败静默返回 null（不阻断请求，Core Service 会验证 JWT 签名）
      return null;
    }
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
