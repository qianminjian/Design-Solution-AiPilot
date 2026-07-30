import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseInterceptors,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  AuthApiPaths,
  ChangePasswordRequest,
  HttpHeader,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  RefreshTokenResponse,
  StepUpTokenRequest,
  loginResponseSchema,
  refreshTokenResponseSchema,
} from "@design-platform/shared";
import {
  ProxyInterceptor,
  ProxyResult,
} from "../../interceptors/proxy.interceptor";
import { ProxyService } from "../proxy.service";
import { SchemaValidator } from "../schema-validator.service";
import { CookieService } from "./cookie.service";

/**
 * 认证域代理控制器
 * - 处理 /api/v1/auth/** 路径
 * - 登录/刷新：将 refresh token 写入 httpOnly Cookie，不返回给浏览器
 * - 登出：清除 Cookie
 * - me/change-password：直接转发
 *
 * 契约验证（security.md §2.2）：
 *  - login/refresh 响应使用严格验证，结构错误即返回 502
 *  - 防止 Core Service 漂移导致前端拿到残缺的 token 字段
 *
 * 权威源：@design/D39-身份多租户-授权.md §D39.7
 *
 * 注意：全局前缀为 "api"，所以 @Controller("v1/auth") 实际匹配 /api/v1/auth/**
 */
@Controller("v1/auth")
@UseInterceptors(ProxyInterceptor)
export class AuthProxyController {
  constructor(
    @Inject(ProxyService) private readonly proxyService: ProxyService,
    @Inject(CookieService) private readonly cookieService: CookieService,
    @Inject(SchemaValidator) private readonly schemaValidator: SchemaValidator,
  ) {}

  /**
   * 登录：转发到 Core Service，从响应中提取 refresh token 写入 Cookie
   */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() request: Request,
    @Body() body: LoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProxyResult> {
    const result = await this.proxyService.forward({
      method: "POST",
      path: AuthApiPaths.login,
      body,
      headers: this.extractForwardHeaders(request),
    });

    // 错误响应（4xx/5xx）直接透传，不参与 schema 验证
    if (result.status >= 200 && result.status < 300) {
      this.handleRefreshTokenFromResponse(result, response);
      this.handleAccessTokenFromResponse(result, response);

      // 严格验证：Core Service 返回的登录响应必须符合契约
      // 验证发生在 refreshToken 已剥离之后，避免 refreshToken 字段干扰 schema
      // 兼容 ApiResponse<T> 包装格式（Java Core Service）与裸对象（单元测试 fixture）
      const businessData = this.schemaValidator.extractBusinessData(result);
      const validatedData = this.schemaValidator.validateStrict(
        businessData,
        loginResponseSchema,
        {
          domain: "auth",
          operation: "login",
          traceId: request.traceId,
          downstreamService: "core-service",
        },
      );
      this.schemaValidator.writeBackBusinessData(result, validatedData);
    }

    return result;
  }

  /**
   * 刷新 token：从 Cookie 读取 refresh token，转发给 Core Service
   */
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Body() body: Partial<LogoutRequest>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProxyResult> {
    const refreshToken = this.cookieService.getRefreshTokenFromCookie(request);
    if (!refreshToken) {
      throw new UnauthorizedException("缺少 refresh token");
    }

    const result = await this.proxyService.forward({
      method: "POST",
      path: AuthApiPaths.refresh,
      body: { ...body, refreshToken },
      headers: this.extractForwardHeaders(request),
    });

    // 错误响应直接透传，不参与 schema 验证
    if (result.status >= 200 && result.status < 300) {
      // refresh token rotation：设置新 cookie
      this.handleRefreshTokenFromResponse(result, response);
      this.handleAccessTokenFromResponse(result, response);

      // 严格验证：refresh 响应必须符合契约（含 accessToken 字段）
      const businessData = this.schemaValidator.extractBusinessData(result);
      const validatedData = this.schemaValidator.validateStrict(
        businessData,
        refreshTokenResponseSchema,
        {
          domain: "auth",
          operation: "refresh",
          traceId: request.traceId,
          downstreamService: "core-service",
        },
      );
      this.schemaValidator.writeBackBusinessData(result, validatedData);
    }

    return result;
  }

  /**
   * 登出：转发到 Core Service，并清除前端 Cookie
   */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body?: Partial<LogoutRequest>,
  ): Promise<ProxyResult> {
    const refreshToken = this.cookieService.getRefreshTokenFromCookie(request);
    const result = await this.proxyService.forward({
      method: "POST",
      path: AuthApiPaths.logout,
      body: { ...body, refreshToken: refreshToken ?? undefined },
      headers: this.extractForwardHeaders(request),
    });

    this.cookieService.clearRefreshTokenCookie(response);
    return result;
  }

  /**
   * 获取当前用户信息：转发 Authorization 头
   */
  @Get("me")
  me(@Req() request: Request): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: "GET",
      path: AuthApiPaths.me,
      headers: this.extractForwardHeaders(request),
    });
  }

  /**
   * 修改密码：转发 Authorization 头与请求体
   */
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Req() request: Request,
    @Body() body: ChangePasswordRequest,
  ): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: "POST",
      path: AuthApiPaths.changePassword,
      body,
      headers: this.extractForwardHeaders(request),
    });
  }

  /**
   * 申请 step-up token（危险动作二次认证）
   *
   * 业务流程：
   * - 已登录用户携带 access token 调用本端点
   * - 服务端校验当前密码后签发短期 step-up token（5 分钟）
   * - 前端将 step-up token 保存在内存中（不写入 localStorage / cookie）
   * - 后续 OperationsAction 请求携带 step-up token
   *
   * 安全约束（见 security.md §12 / D40 §Step-up 认证）：
   * - 不做 schema 严格验证（响应结构简单，且需要快速返回给前端）
   * - access token 通过 Cookie 携带，无需手动设置
   *
   * @design D40-信息-物理安全.md §Step-up 认证
   * @design D37-关键界面-交互状态.md §D37.17 危险动作
   */
  @Post("step-up")
  @HttpCode(HttpStatus.OK)
  stepUp(
    @Req() request: Request,
    @Body() body: StepUpTokenRequest,
  ): Promise<ProxyResult> {
    return this.proxyService.forward({
      method: "POST",
      path: AuthApiPaths.stepUp,
      body,
      headers: this.extractForwardHeaders(request),
    });
  }

  /**
   * 提取需要转发给 Core Service 的请求头
   * 认证域不需要转发 Authorization（登录无 token），但 me/change-password 需要
   */
  private extractForwardHeaders(
    request: Request,
  ): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};
    const forwardHeaderNames = [
      HttpHeader.AUTHORIZATION,
      HttpHeader.X_TENANT_ID,
      HttpHeader.X_TRACE_ID,
      HttpHeader.IDEMPOTENCY_KEY,
      "content-type",
      HttpHeader.ACCEPT_LANGUAGE,
    ];

    for (const name of forwardHeaderNames) {
      const value = request.header(name);
      if (value !== undefined && value.length > 0) {
        headers[name] = value;
      }
    }

    if (!headers[HttpHeader.X_TRACE_ID] && request.traceId) {
      headers[HttpHeader.X_TRACE_ID] = request.traceId;
    }

    return headers;
  }

  /**
   * 从下游响应中提取 access token 和 tenant ID 并写入 Cookie
   * - access_token Cookie（httpOnly, 15min）：供前端 fetch 请求携带
   * - tenant_id Cookie（非 httpOnly）：供前端读取后设置 x-tenant-id header
   */
  private handleAccessTokenFromResponse(
    result: ProxyResult,
    response: Response,
  ): void {
    const data = this.schemaValidator.extractBusinessData(result) as
      | (Partial<LoginResponse> & {
          accessToken?: string;
          tenant?: { id: string };
        })
      | undefined;

    if (data?.accessToken) {
      this.cookieService.setAccessTokenCookie(response, data.accessToken);
    }
    if (data?.tenant?.id) {
      this.cookieService.setTenantIdCookie(response, data.tenant.id);
    }
  }

  /**
   * 从下游响应中提取 refresh token 并写入 Cookie
   * - 下游响应里 refreshToken 字段不暴露给浏览器（删除后再透传）
   * - 兼容 ApiResponse<T> 包装格式（Java Core Service）与裸对象（单元测试 fixture）
   */
  private handleRefreshTokenFromResponse(
    result: ProxyResult,
    response: Response,
  ): void {
    const data = this.schemaValidator.extractBusinessData(result) as
      | (Partial<LoginResponse> & { refreshToken?: string })
      | (Partial<RefreshTokenResponse> & { refreshToken?: string })
      | undefined;

    if (
      data &&
      typeof data === "object" &&
      typeof data.refreshToken === "string"
    ) {
      this.cookieService.setRefreshTokenCookie(response, data.refreshToken);
      // 从响应体中删除 refresh token，避免泄露给浏览器
      delete data.refreshToken;
    }
  }
}
