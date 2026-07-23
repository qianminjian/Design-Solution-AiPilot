import { vi, type Mocked } from "vitest";
import { of, throwError } from "rxjs";
import type {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  Method,
} from "axios";
import type { HttpService } from "@nestjs/axios";

/**
 * HttpService 的可 mock 类型
 * Vitest 的 Mocked<T> 会将方法签名变为 Mock<T>
 */
export type HttpServiceMock = Mocked<HttpService>;

/**
 * 构造 AxiosResponse 风格的对象
 * 用于 HttpService mock 返回值
 */
export function buildAxiosResponse<T>(
  data: T,
  status = 200,
  headers: Record<string, unknown> = {},
): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status === 200 ? "OK" : "Unknown",
    headers,
    config: {
      url: "",
      method: "get" as Method,
      headers: {},
    } as AxiosRequestConfig,
  };
}

/**
 * 构造 AxiosError 风格的下游错误对象
 * 用于测试下游 Core Service 错误透传场景
 */
export function buildAxiosError(
  status: number,
  data: unknown,
  url = "http://downstream/v1/test",
): AxiosError {
  const error = new Error(
    `Request failed with status code ${status}`,
  ) as AxiosError;
  (error as unknown as { isAxiosError: boolean }).isAxiosError = true;
  (error as AxiosError).response = {
    data,
    status,
    statusText: "Error",
    headers: {},
    config: {} as AxiosRequestConfig,
  };
  (error as AxiosError).config = {} as AxiosRequestConfig;
  (error as AxiosError).request = { url };
  return error;
}

/**
 * HttpService mock 工厂
 * - request/get/post/put/patch/delete/head 返回 RxJS Observable
 * - 默认实现返回 200 空响应
 * - 测试可通过 mockReturnValue / mockImplementation 设置返回值
 *
 * 用法：
 * ```ts
 * const httpService = createHttpServiceMock();
 * httpService.request.mockReturnValue(of(buildAxiosResponse({ ok: true })));
 * ```
 */
export function createHttpServiceMock(): HttpServiceMock {
  const defaultResponse = buildAxiosResponse({ ok: true });
  const requestFn = vi.fn().mockReturnValue(of(defaultResponse));
  const mock = {
    request: requestFn,
    get: vi.fn().mockReturnValue(of(defaultResponse)),
    post: vi.fn().mockReturnValue(of(defaultResponse)),
    put: vi.fn().mockReturnValue(of(defaultResponse)),
    patch: vi.fn().mockReturnValue(of(defaultResponse)),
    delete: vi.fn().mockReturnValue(of(defaultResponse)),
    head: vi.fn().mockReturnValue(of(defaultResponse)),
    axiosRef: vi.fn(),
  } as unknown as HttpServiceMock;

  return mock;
}

/**
 * 让 HttpService.request 在下次调用时返回指定响应（或顺序响应队列）
 */
export function mockHttpSuccess(
  httpService: HttpServiceMock,
  response: AxiosResponse | AxiosResponse[],
): void {
  if (Array.isArray(response)) {
    const queue = [...response];
    httpService.request.mockImplementation(() => {
      const next = queue.shift() ?? buildAxiosResponse({});
      return of(next);
    });
    return;
  }
  httpService.request.mockReturnValue(of(response));
}

/**
 * 让 HttpService mock 在下次调用时抛出错误
 * 用于测试下游错误透传与降级逻辑
 */
export function mockHttpError(
  httpService: HttpServiceMock,
  error: unknown,
): void {
  const error$ = throwError(() => error);
  httpService.request.mockReturnValue(error$);
  httpService.get.mockReturnValue(error$);
  httpService.post.mockReturnValue(error$);
}
