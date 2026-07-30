import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { AxiosError, AxiosRequestConfig, AxiosResponse, Method } from "axios";
import { firstValueFrom } from "rxjs";
import appConfig from "../../config/app.config";
import { ProxyResult } from "../../interceptors/proxy.interceptor";

export interface AiForwardOptions {
  method: Method;
  path: string;
  body?: unknown;
  headers: Record<string, string | string[]>;
  query?: Record<string, string | string[]>;
}

@Injectable()
export class AiProxyService {
  private static readonly FORWARD_TIMEOUT_MS = 30_000;
  private readonly logger = new Logger(AiProxyService.name);

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
    private readonly httpService: HttpService,
  ) {}

  async forwardCapabilities(options: AiForwardOptions): Promise<ProxyResult> {
    return this.forward(options);
  }

  async forwardPrompts(options: AiForwardOptions): Promise<ProxyResult> {
    return this.forward(options);
  }

  async forwardSolutions(options: AiForwardOptions): Promise<ProxyResult> {
    return this.forward(options);
  }

  async forwardRag(options: AiForwardOptions): Promise<ProxyResult> {
    return this.forward(options);
  }

  private async forward(options: AiForwardOptions): Promise<ProxyResult> {
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

  private buildDownstreamUrl(path: string): string {
    const base = this.config.aiServiceUrl.replace(/\/+$/, "");
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
  }

  private buildRequestConfig(
    options: AiForwardOptions,
    url: string,
  ): AxiosRequestConfig {
    return {
      url,
      method: options.method,
      data: options.body,
      params: options.query,
      headers: { ...options.headers },
      timeout: AiProxyService.FORWARD_TIMEOUT_MS,
      validateStatus: () => true,
      maxRedirects: 0,
      responseType: "json",
    };
  }

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

  private logDownstreamError(
    error: unknown,
    options: AiForwardOptions,
    url: string,
  ): void {
    if (this.isAxiosError(error)) {
      const status = error.response?.status ?? "n/a";
      this.logger.warn(
        `AI服务调用失败 method=${options.method} url=${url} status=${status} traceId=${this.extractTraceId(options.headers)}`,
      );
      return;
    }
    this.logger.error(
      `AI服务调用异常 method=${options.method} url=${url}`,
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
