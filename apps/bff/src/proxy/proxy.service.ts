import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { AxiosError, AxiosRequestConfig, AxiosResponse, Method } from "axios";
import { firstValueFrom } from "rxjs";
import appConfig from "../config/app.config";
import { ProxyResult } from "../interceptors/proxy.interceptor";

/**
 * 代理转发请求参数
 */
export interface ForwardOptions {
  /** HTTP 方法 */
  method: Method;
  /** 下游路径（含 query string），如 /v1/principals?pageSize=10 */
  path: string;
  /** 请求体（POST/PUT/PATCH） */
  body?: unknown;
  /** 业务请求头（Authorization、x-tenant-id 等） */
  headers: Record<string, string | string[]>;
  /** 查询参数对象 */
  query?: Record<string, string | string[]>;
}

/**
 * 代理服务
 * - 封装 HttpService 调用 Core Service 的逻辑
 * - 默认超时 30s（与 HttpModule 全局配置一致）
 * - 下游非 2xx 响应保留原始 AxiosError 抛出，交由全局过滤器处理
 */
@Injectable()
export class ProxyService {
  private static readonly FORWARD_TIMEOUT_MS = 30_000;
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * 转发请求到 Core Service
   * @returns 下游响应（status/data/headers）
   */
  async forward(options: ForwardOptions): Promise<ProxyResult> {
    const url = this.buildDownstreamUrl(options.path);
    const requestConfig = this.buildRequestConfig(options, url);

    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.request(requestConfig),
      );
      return {
        status: response.status,
        data: response.data,
        headers: this.pickHeaders(response.headers),
      };
    } catch (error) {
      this.logDownstreamError(error, options, url);
      throw error;
    }
  }

  /**
   * 构造下游 URL（避免重复拼接 /）
   */
  private buildDownstreamUrl(path: string): string {
    const base = this.config.coreServiceUrl.replace(/\/+$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
  }

  /**
   * 构造 Axios 请求配置
   */
  private buildRequestConfig(
    options: ForwardOptions,
    url: string,
  ): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      url,
      method: options.method,
      data: options.body,
      params: options.query,
      headers: { ...options.headers },
      timeout: ProxyService.FORWARD_TIMEOUT_MS,
      // 错误响应不上抛（status >= 400 仍然进入 then），便于保留原始响应体
      validateStatus: () => true,
      // 不自动重定向
      maxRedirects: 0,
      // 保持 JSON 解析能力
      responseType: "json",
    };
    return config;
  }

  /**
   * 从下游响应头中挑选需要透传给前端的头
   */
  private pickHeaders(
    headers: Record<string, unknown>,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    const allowed = [
      "etag",
      "content-type",
      "content-language",
      "last-modified",
      "location",
      "retry-after",
    ];
    for (const key of allowed) {
      const value = headers[key];
      if (typeof value === "string" && value.length > 0) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * 记录下游错误日志（不打印敏感头）
   */
  private logDownstreamError(
    error: unknown,
    options: ForwardOptions,
    url: string,
  ): void {
    if (this.isAxiosError(error)) {
      const status = error.response?.status ?? "n/a";
      this.logger.warn(
        `下游调用失败 method=${options.method} url=${url} status=${status} traceId=${this.extractTraceId(options.headers)}`,
      );
      return;
    }
    this.logger.error(
      `下游调用异常 method=${options.method} url=${url}`,
      error instanceof Error ? error.stack : String(error),
    );
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return (
      typeof error === "object" &&
      error !== null &&
      "isAxiosError" in error &&
      (error as { isAxiosError: unknown }).isAxiosError === true
    );
  }

  private extractTraceId(headers: Record<string, string | string[]>): string {
    const value = headers["x-trace-id"];
    return Array.isArray(value)
      ? (value[0] ?? "unknown")
      : (value ?? "unknown");
  }
}
