import { describe, it, expect, vi, beforeEach } from "vitest";
import { of, throwError } from "rxjs";
import type { AxiosError, AxiosResponse } from "axios";
import { ProxyService } from "../../../src/proxy/proxy.service";
import {
  createHttpServiceMock,
  buildAxiosResponse,
  buildAxiosError,
  type HttpServiceMock,
} from "../../__support__/mocks/http-service.mock";

/** 测试用 app config（覆盖 ProxyService 实际访问的字段） */
const TEST_CONFIG = {
  coreServiceUrl: "http://core.test/",
} as const;

describe("ProxyService", () => {
  let httpService: HttpServiceMock;

  beforeEach(() => {
    httpService = createHttpServiceMock();
  });

  it("应该将 path 拼接到 coreServiceUrl 后调用下游并返回 ProxyResult", async () => {
    // Arrange
    const downstreamResponse = buildAxiosResponse(
      { items: [{ id: "p1" }] },
      200,
      { etag: '"v1"', "content-type": "application/json" },
    );
    vi.mocked(httpService.request).mockReturnValue(of(downstreamResponse));
    const service = new ProxyService(TEST_CONFIG as never, httpService);

    // Act
    const result = await service.forward({
      method: "GET",
      path: "/v1/projects",
      headers: { "x-trace-id": "trace-1" },
    });

    // Assert：URL 拼接（base 末尾 / 应被去掉）
    const callArgs = vi.mocked(httpService.request).mock.calls[0][0];
    expect(callArgs.url).toBe("http://core.test/v1/projects");
    expect(callArgs.method).toBe("GET");
    // Assert：返回 ProxyResult
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ items: [{ id: "p1" }] });
    // Assert：仅保留业务相关响应头
    expect(result.headers.etag).toBe('"v1"');
    expect(result.headers["content-type"]).toBe("application/json");
  });

  it("应该正确拼接 base 末尾不带 / 的 coreServiceUrl", async () => {
    // Arrange
    vi.mocked(httpService.request).mockReturnValue(of(buildAxiosResponse({})));
    const service = new ProxyService(
      { coreServiceUrl: "http://core.test" } as never,
      httpService,
    );

    // Act
    await service.forward({
      method: "GET",
      path: "/v1/projects",
      headers: {},
    });

    // Assert
    const callArgs = vi.mocked(httpService.request).mock.calls[0][0];
    expect(callArgs.url).toBe("http://core.test/v1/projects");
  });

  it("应该在 path 不以 / 开头时自动补 /", async () => {
    // Arrange
    vi.mocked(httpService.request).mockReturnValue(of(buildAxiosResponse({})));
    const service = new ProxyService(TEST_CONFIG as never, httpService);

    // Act
    await service.forward({ method: "GET", path: "v1/projects", headers: {} });

    // Assert
    const callArgs = vi.mocked(httpService.request).mock.calls[0][0];
    expect(callArgs.url).toBe("http://core.test/v1/projects");
  });

  it("应该将 body/params/headers 透传给 HttpService", async () => {
    // Arrange
    vi.mocked(httpService.request).mockReturnValue(of(buildAxiosResponse({})));
    const service = new ProxyService(TEST_CONFIG as never, httpService);
    const headers = {
      authorization: "Bearer token",
      "x-trace-id": "trace-1",
    };
    const body = { name: "test" };
    const query = { page: "1" };

    // Act
    await service.forward({
      method: "POST",
      path: "/v1/projects",
      body,
      headers,
      query,
    });

    // Assert
    const callArgs = vi.mocked(httpService.request).mock.calls[0][0];
    expect(callArgs.method).toBe("POST");
    expect(callArgs.data).toEqual(body);
    expect(callArgs.params).toEqual(query);
    expect(callArgs.headers).toEqual(headers);
    expect(callArgs.timeout).toBe(30_000);
    expect(callArgs.maxRedirects).toBe(0);
  });

  it("应该原样抛出下游 AxiosError（不包装），交由全局过滤器处理", async () => {
    // Arrange
    const downstreamError = buildAxiosError(404, { errorCode: "NOT_FOUND" });
    vi.mocked(httpService.request).mockReturnValue(
      throwError(() => downstreamError),
    );
    const service = new ProxyService(TEST_CONFIG as never, httpService);

    // Act & Assert：错误原样抛出
    await expect(
      service.forward({
        method: "GET",
        path: "/v1/projects/missing",
        headers: { "x-trace-id": "trace-1" },
      }),
    ).rejects.toBe(downstreamError);
  });

  it("应该仅在响应头白名单中挑选业务相关头（过滤 hop-by-hop）", async () => {
    // Arrange
    const downstreamResponse: AxiosResponse = buildAxiosResponse(
      { ok: true },
      200,
      {
        etag: '"v2"',
        "content-type": "application/json",
        "content-language": "zh-CN",
        "last-modified": "Wed, 21 Oct 2026 07:28:00 GMT",
        location: "http://core.test/v1/projects/p1",
        "retry-after": "30",
        // 以下应被过滤
        "content-length": "123",
        "content-encoding": "gzip",
        "transfer-encoding": "chunked",
        connection: "keep-alive",
      },
    );
    vi.mocked(httpService.request).mockReturnValue(of(downstreamResponse));
    const service = new ProxyService(TEST_CONFIG as never, httpService);

    // Act
    const result = await service.forward({
      method: "GET",
      path: "/v1/projects/p1",
      headers: {},
    });

    // Assert：仅保留白名单头
    expect(Object.keys(result.headers).sort()).toEqual(
      [
        "content-type",
        "content-language",
        "etag",
        "last-modified",
        "location",
        "retry-after",
      ].sort(),
    );
    // 过滤掉 hop-by-hop / content-length
    expect(result.headers).not.toHaveProperty("content-length");
    expect(result.headers).not.toHaveProperty("content-encoding");
    expect(result.headers).not.toHaveProperty("transfer-encoding");
    expect(result.headers).not.toHaveProperty("connection");
  });

  it("应该过滤响应头中非字符串或空字符串值", async () => {
    // Arrange
    const downstreamResponse: AxiosResponse = buildAxiosResponse(
      { ok: true },
      200,
      {
        etag: "", // 空字符串应被过滤
        "content-type": "application/json",
        location: undefined, // 非字符串应被过滤
      },
    );
    vi.mocked(httpService.request).mockReturnValue(of(downstreamResponse));
    const service = new ProxyService(TEST_CONFIG as never, httpService);

    // Act
    const result = await service.forward({
      method: "GET",
      path: "/v1/projects",
      headers: {},
    });

    // Assert
    expect(result.headers).not.toHaveProperty("etag");
    expect(result.headers).not.toHaveProperty("location");
    expect(result.headers["content-type"]).toBe("application/json");
  });

  it("应该在下游错误为 AxiosError 时记录 warn 日志", async () => {
    // Arrange
    const downstreamError = buildAxiosError(500, { errorCode: "INTERNAL" });
    vi.mocked(httpService.request).mockReturnValue(
      throwError(() => downstreamError),
    );
    const service = new ProxyService(TEST_CONFIG as never, httpService);
    const warnSpy = vi
      .spyOn(service["logger"], "warn")
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(service["logger"], "error")
      .mockImplementation(() => undefined);

    // Act
    await expect(
      service.forward({
        method: "POST",
        path: "/v1/projects",
        headers: { "x-trace-id": "trace-1" },
      }),
    ).rejects.toBe(downstreamError);

    // Assert：AxiosError 走 warn，不走 error
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("应该在下游错误为非 AxiosError 时记录 error 日志（含 stack）", async () => {
    // Arrange：构造非 AxiosError（如序列化失败、网络层错误）
    const unknownError: unknown = new Error("网络层异常");
    vi.mocked(httpService.request).mockReturnValue(
      throwError(() => unknownError),
    );
    const service = new ProxyService(TEST_CONFIG as never, httpService);
    const warnSpy = vi
      .spyOn(service["logger"], "warn")
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(service["logger"], "error")
      .mockImplementation(() => undefined);

    // Act
    await expect(
      service.forward({
        method: "POST",
        path: "/v1/projects",
        headers: {},
      }),
    ).rejects.toBe(unknownError);

    // Assert：非 AxiosError 走 error，附带 stack
    expect(errorSpy).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("应该从请求头 x-trace-id 提取 traceId 写入错误日志（数组形式）", async () => {
    // Arrange：headers 中 x-trace-id 为数组
    const downstreamError = buildAxiosError(503, {});
    vi.mocked(httpService.request).mockReturnValue(
      throwError(() => downstreamError),
    );
    const service = new ProxyService(TEST_CONFIG as never, httpService);
    const warnSpy = vi
      .spyOn(service["logger"], "warn")
      .mockImplementation(() => undefined);

    // Act
    await expect(
      service.forward({
        method: "GET",
        path: "/v1/projects",
        headers: { "x-trace-id": ["trace-arr-1", "trace-arr-2"] },
      }),
    ).rejects.toBe(downstreamError);

    // Assert：日志中包含数组第一个值
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("traceId=trace-arr-1"),
    );
    warnSpy.mockRestore();
  });

  it("应该在 headers 中无 x-trace-id 时记录 traceId=unknown", async () => {
    // Arrange
    const downstreamError = buildAxiosError(500, {});
    vi.mocked(httpService.request).mockReturnValue(
      throwError(() => downstreamError),
    );
    const service = new ProxyService(TEST_CONFIG as never, httpService);
    const warnSpy = vi
      .spyOn(service["logger"], "warn")
      .mockImplementation(() => undefined);

    // Act
    await expect(
      service.forward({
        method: "GET",
        path: "/v1/projects",
        headers: {},
      }),
    ).rejects.toBe(downstreamError);

    // Assert
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("traceId=unknown"),
    );
    warnSpy.mockRestore();
  });
});
