import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import {
  ApiErrorResponse,
  ErrorCode,
  HttpHeader,
} from "@design-platform/shared";
import { HttpExceptionFilter } from "../../../src/filters/http-exception.filter";
import { buildAxiosError } from "../../__support__/mocks/http-service.mock";

/** 构造带 traceId 的 Request mock */
function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    url: "/api/v1/test",
    traceId: "test-trace-id-123",
    header: vi.fn((name: string) =>
      name === HttpHeader.X_TRACE_ID ? "test-trace-id-123" : undefined,
    ),
    ...overrides,
  } as unknown as Request;
}

/** 构造测试上下文：filter + 捕获的 reply payload + status */
function createContext(request?: Request) {
  const captured: { payload: ApiErrorResponse | null; status: number } = {
    payload: null,
    status: 0,
  };
  const httpAdapterHost = {
    httpAdapter: {
      reply: vi.fn((_response: Response, payload: unknown, status: number) => {
        captured.payload = payload as ApiErrorResponse;
        captured.status = status;
        return _response;
      }),
    },
  } as unknown as HttpAdapterHost;
  const host = {
    switchToHttp: () => ({
      getRequest: () => request ?? createRequest(),
      getResponse: () => ({}) as Response,
    }),
    getType: () => "http",
  } as unknown as Parameters<HttpExceptionFilter["catch"]>[1];
  return { filter: new HttpExceptionFilter(httpAdapterHost), captured, host };
}

describe("HttpExceptionFilter", () => {
  it("应该将 HttpException（字符串 response）转换为 ApiErrorResponse", () => {
    // Arrange
    const { filter, captured, host } = createContext();

    // Act
    filter.catch(new BadRequestException("参数不合法"), host);

    // Assert
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.payload?.errorCode).toBe(ErrorCode.INTERNAL_ERROR);
    expect(captured.payload?.detail).toBe("参数不合法");
    expect(captured.payload?.correlationId).toBe("test-trace-id-123");
  });

  it("应该将 HttpException（对象 message 数组）合并为 detail", () => {
    // Arrange
    const { filter, captured, host } = createContext();
    const exception = new BadRequestException({
      message: ["email 必填", "password 必填"],
      error: "Bad Request",
    });

    // Act
    filter.catch(exception as HttpException, host);

    // Assert
    expect(captured.payload?.detail).toBe("email 必填; password 必填");
  });

  it("应该透传已是 ApiErrorResponse 形态的 HttpException 响应体", () => {
    // Arrange
    const { filter, captured, host } = createContext();
    const errorResponse: ApiErrorResponse = {
      code: 1,
      errorCode: ErrorCode.RESOURCE_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
      title: "Not Found",
      detail: "项目不存在",
      correlationId: "test-trace-id-123",
      retryable: false,
    };

    // Act
    filter.catch(new NotFoundException(errorResponse), host);

    // Assert
    expect(captured.status).toBe(HttpStatus.NOT_FOUND);
    expect(captured.payload?.errorCode).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    expect(captured.payload?.detail).toBe("项目不存在");
  });

  it("应该将 401/403 HttpException 保留对应状态码", () => {
    // Arrange
    const { filter, captured, host } = createContext();

    // Act & Assert：401
    filter.catch(new UnauthorizedException(), host);
    expect(captured.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(captured.payload?.title).toBe("Unauthorized");

    // Act & Assert：403
    filter.catch(new ForbiddenException(), host);
    expect(captured.status).toBe(HttpStatus.FORBIDDEN);
    expect(captured.payload?.title).toBe("Forbidden");
  });

  it("应该将 AxiosError（含 ApiErrorResponse 响应体）原样转发状态码并将 correlationId 改为当前 traceId", () => {
    // Arrange
    const { filter, captured, host } = createContext();
    const downstreamBody: ApiErrorResponse = {
      code: 1,
      errorCode: ErrorCode.STATE_CONFLICT,
      status: HttpStatus.CONFLICT,
      title: "Conflict",
      detail: "项目名重复",
      correlationId: "downstream-trace-id",
      retryable: false,
    };
    const axiosError = buildAxiosError(HttpStatus.CONFLICT, downstreamBody);

    // Act
    filter.catch(axiosError, host);

    // Assert
    expect(captured.status).toBe(HttpStatus.CONFLICT);
    expect(captured.payload?.errorCode).toBe(ErrorCode.STATE_CONFLICT);
    expect(captured.payload?.correlationId).toBe("test-trace-id-123");
  });

  it("应该在 AxiosError 响应体不含 ApiErrorResponse 字段时使用 DEPENDENCY_FAILED", () => {
    // Arrange
    const { filter, captured, host } = createContext();
    const axiosError = buildAxiosError(500, { random: "data" });

    // Act
    filter.catch(axiosError, host);

    // Assert
    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.payload?.errorCode).toBe(ErrorCode.DEPENDENCY_FAILED);
    expect(captured.payload?.detail).toBe("下游服务错误");
  });

  it("应该在 AxiosError 没有 response 时返回 502 BAD_GATEWAY", () => {
    // Arrange：构造无 response 的 AxiosError（连接失败场景）
    const { filter, captured, host } = createContext();
    const error = new Error("connect ECONNREFUSED") as Error & {
      isAxiosError: boolean;
    };
    error.isAxiosError = true;

    // Act
    filter.catch(error, host);

    // Assert
    expect(captured.status).toBe(HttpStatus.BAD_GATEWAY);
    expect(captured.payload?.errorCode).toBe(ErrorCode.DEPENDENCY_FAILED);
  });

  it("应该将未知异常统一包装为 500 INTERNAL_ERROR", () => {
    // Arrange
    const { filter, captured, host } = createContext();

    // Act
    filter.catch(new Error("意料之外的错误"), host);

    // Assert
    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.payload?.errorCode).toBe(ErrorCode.INTERNAL_ERROR);
    expect(captured.payload?.detail).toBe("服务内部错误");
  });

  it("应该在没有 traceId 时使用 fallback 值 'unknown'", () => {
    // Arrange：构造无 traceId 的请求
    const request = {
      method: "GET",
      url: "/api/v1/test",
      header: vi.fn(() => undefined),
    } as unknown as Request;
    const { filter, captured, host } = createContext(request);

    // Act
    filter.catch(new Error("任意错误"), host);

    // Assert
    expect(captured.payload?.correlationId).toBe("unknown");
  });

  it("应该在 5xx 异常时调用 logger.error，4xx 时调用 logger.warn", () => {
    // Arrange
    const { filter, host } = createContext();
    const errorSpy = vi
      .spyOn(filter["logger"], "error")
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(filter["logger"], "warn")
      .mockImplementation(() => undefined);

    // Act & Assert：5xx 走 error
    filter.catch(new Error("服务异常"), host);
    expect(errorSpy).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    errorSpy.mockClear();
    warnSpy.mockClear();

    // Act & Assert：4xx 走 warn
    filter.catch(new BadRequestException(), host);
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
