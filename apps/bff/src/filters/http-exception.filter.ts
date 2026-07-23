import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Request, Response } from "express";
import { AxiosError } from "axios";
import {
  ApiErrorResponse,
  ErrorCode,
  ERROR_HTTP_STATUS,
  HttpHeader,
} from "@design-platform/shared";

/**
 * 全局异常过滤器
 * - HttpException：保留原有状态码和响应体
 * - AxiosError：下游 Core Service 错误，原样转发
 * - 其他异常：统一包装为 500 INTERNAL_ERROR
 *
 * 所有响应遵循 ApiErrorResponse 格式
 * 权威源：@design/D35-API-事件契约.md §D35.9
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId =
      request.traceId ?? request.header(HttpHeader.X_TRACE_ID) ?? "unknown";

    const { status, payload } = this.resolve(exception, traceId);

    if (status >= 500) {
      this.logger.error(
        `请求处理异常 traceId=${traceId} method=${request.method} url=${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `业务异常 traceId=${traceId} status=${status} url=${request.url} payload=${JSON.stringify(payload)}`,
      );
    }

    const { httpAdapter } = this.httpAdapterHost;
    httpAdapter.reply(response, payload, status);
  }

  /**
   * 将异常解析为 HTTP 状态码与 ApiErrorResponse 载荷
   */
  private resolve(
    exception: unknown,
    traceId: string,
  ): {
    status: number;
    payload: ApiErrorResponse;
  } {
    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception, traceId);
    }
    if (this.isAxiosError(exception)) {
      return this.resolveAxiosError(exception, traceId);
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      payload: this.buildError(
        ErrorCode.INTERNAL_ERROR,
        "Internal Server Error",
        "服务内部错误",
        traceId,
      ),
    };
  }

  /**
   * 解析 NestJS HttpException
   */
  private resolveHttpException(
    exception: HttpException,
    traceId: string,
  ): { status: number; payload: ApiErrorResponse } {
    const status = exception.getStatus();
    const response = exception.getResponse();
    const payload = this.normalizeHttpExceptionPayload(
      response,
      status,
      traceId,
    );
    return { status, payload };
  }

  /**
   * 将 HttpException 的多种 response 形态统一为 ApiErrorResponse
   */
  private normalizeHttpExceptionPayload(
    response: unknown,
    status: number,
    traceId: string,
  ): ApiErrorResponse {
    // 字符串形态
    if (typeof response === "string") {
      return this.buildError(
        ErrorCode.INTERNAL_ERROR,
        exceptionTitle(status),
        response,
        traceId,
      );
    }
    // 对象形态：若已是 ApiErrorResponse 结构则透传
    if (response && typeof response === "object") {
      const obj = response as Record<string, unknown>;
      if (typeof obj.errorCode === "string" && typeof obj.status === "number") {
        return {
          code: typeof obj.code === "number" ? obj.code : obj.status,
          errorCode: obj.errorCode,
          status: obj.status,
          title:
            typeof obj.title === "string" ? obj.title : exceptionTitle(status),
          detail:
            typeof obj.detail === "string"
              ? obj.detail
              : typeof obj.message === "string"
                ? obj.message
                : exceptionTitle(status),
          correlationId: traceId,
          errors: Array.isArray(obj.errors) ? obj.errors : undefined,
          retryable: typeof obj.retryable === "boolean" ? obj.retryable : false,
          retryAfter:
            typeof obj.retryAfter === "number" ? obj.retryAfter : undefined,
        };
      }
      // 标准消息形态 { message: string | string[], error: string }
      const message = obj.message;
      const detail = Array.isArray(message)
        ? message.join("; ")
        : typeof message === "string"
          ? message
          : typeof obj.error === "string"
            ? obj.error
            : exceptionTitle(status);
      return this.buildError(
        ErrorCode.INTERNAL_ERROR,
        typeof obj.error === "string" ? obj.error : exceptionTitle(status),
        detail,
        traceId,
      );
    }
    return this.buildError(
      ErrorCode.INTERNAL_ERROR,
      exceptionTitle(status),
      exceptionTitle(status),
      traceId,
    );
  }

  /**
   * 解析下游 Core Service AxiosError
   * 若下游返回 ApiErrorResponse 则原样转发（correlationId 改为本请求 traceId）
   */
  private resolveAxiosError(
    exception: AxiosError,
    traceId: string,
  ): { status: number; payload: ApiErrorResponse } {
    const downstreamStatus =
      exception.response?.status ?? HttpStatus.BAD_GATEWAY;
    const status =
      downstreamStatus >= 400 && downstreamStatus < 600
        ? downstreamStatus
        : HttpStatus.BAD_GATEWAY;
    const downstreamBody = exception.response?.data;
    const payload = this.normalizeDownstreamPayload(
      downstreamBody,
      status,
      traceId,
    );
    return { status, payload };
  }

  /**
   * 将下游响应体归一化为 ApiErrorResponse
   */
  private normalizeDownstreamPayload(
    body: unknown,
    status: number,
    traceId: string,
  ): ApiErrorResponse {
    if (body && typeof body === "object") {
      const obj = body as Record<string, unknown>;
      if (typeof obj.errorCode === "string" && typeof obj.status === "number") {
        return {
          code: typeof obj.code === "number" ? obj.code : obj.status,
          errorCode: obj.errorCode,
          status: obj.status,
          title:
            typeof obj.title === "string" ? obj.title : exceptionTitle(status),
          detail:
            typeof obj.detail === "string"
              ? obj.detail
              : typeof obj.message === "string"
                ? obj.message
                : exceptionTitle(status),
          correlationId: traceId,
          errors: Array.isArray(obj.errors) ? obj.errors : undefined,
          retryable: typeof obj.retryable === "boolean" ? obj.retryable : false,
          retryAfter:
            typeof obj.retryAfter === "number" ? obj.retryAfter : undefined,
        };
      }
    }
    return this.buildError(
      ErrorCode.DEPENDENCY_FAILED,
      exceptionTitle(status),
      "下游服务错误",
      traceId,
    );
  }

  /**
   * 判断是否为 AxiosError（避免对 axios 类型做强依赖）
   */
  private isAxiosError(error: unknown): error is AxiosError {
    return (
      typeof error === "object" &&
      error !== null &&
      "isAxiosError" in error &&
      (error as { isAxiosError: unknown }).isAxiosError === true
    );
  }

  /**
   * 构造 ApiErrorResponse
   */
  private buildError(
    errorCode: ErrorCode,
    title: string,
    detail: string,
    traceId: string,
    retryable = false,
  ): ApiErrorResponse {
    return {
      code: 1,
      errorCode,
      status: ERROR_HTTP_STATUS[errorCode],
      title,
      detail,
      correlationId: traceId,
      retryable,
    };
  }
}

/**
 * 根据 HTTP 状态码生成默认标题
 */
function exceptionTitle(status: number): string {
  const titleMap: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    412: "Precondition Failed",
    413: "Payload Too Large",
    415: "Unsupported Media Type",
    422: "Unprocessable Entity",
    428: "Precondition Required",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };
  return titleMap[status] ?? "Internal Server Error";
}
