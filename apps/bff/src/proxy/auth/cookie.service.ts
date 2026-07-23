import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";

/**
 * refresh token Cookie 名称
 */
const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

/**
 * refresh token 默认有效期（7 天，单位：毫秒）
 * 与 security.md §2.2 规定的 7 天上限对齐
 */
const DEFAULT_REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cookie 服务
 * - 负责设置/清除/读取 refresh token Cookie
 * - Cookie 配置：httpOnly + Secure(生产) + SameSite=Strict + Path=/api/v1/auth
 * - 权威源：@design/D39-身份多租户-授权.md §D39.7 + security.md §2.2
 */
@Injectable()
export class CookieService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 设置 refresh token Cookie
   * @param response Express 响应对象
   * @param token refresh token 值
   * @param maxAgeMs 有效期（毫秒），默认 7 天
   */
  setRefreshTokenCookie(
    response: Response,
    token: string,
    maxAgeMs: number = DEFAULT_REFRESH_TOKEN_MAX_AGE_MS,
  ): void {
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: maxAgeMs,
    });
  }

  /**
   * 清除 refresh token Cookie
   */
  clearRefreshTokenCookie(response: Response): void {
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: "strict",
      path: "/api/v1/auth",
    });
  }

  /**
   * 从请求 Cookie 中读取 refresh token
   * - 不依赖 cookie-parser 中间件，自行解析 Cookie header
   * @returns refresh token 值；不存在返回 null
   */
  getRefreshTokenFromCookie(request: Request): string | null {
    // 优先使用 cookie-parser 解析结果（若已挂载）
    const parsed = (request as Request & { cookies?: Record<string, string> })
      .cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (typeof parsed === "string" && parsed.length > 0) {
      return parsed;
    }
    // 回退到手动解析 Cookie header
    const cookieHeader = request.headers.cookie;
    if (typeof cookieHeader !== "string" || cookieHeader.length === 0) {
      return null;
    }
    const cookies = this.parseCookieHeader(cookieHeader);
    const raw = cookies[REFRESH_TOKEN_COOKIE_NAME];
    return typeof raw === "string" && raw.length > 0 ? raw : null;
  }

  /**
   * 简单解析 Cookie header，不依赖 cookie-parser
   * 仅支持 name=value 形式，value 支持 URL 编码
   */
  private parseCookieHeader(header: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const pair of header.split(";")) {
      const trimmed = pair.trim();
      if (trimmed.length === 0) continue;
      const equalIndex = trimmed.indexOf("=");
      if (equalIndex <= 0) continue;
      const key = trimmed.slice(0, equalIndex).trim();
      const value = trimmed.slice(equalIndex + 1).trim();
      try {
        result[key] = decodeURIComponent(value);
      } catch {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * 判断当前是否为生产环境
   * 生产环境强制启用 Secure 标记
   */
  private isProduction(): boolean {
    return this.configService.get<string>("app.environment") === "production";
  }
}
