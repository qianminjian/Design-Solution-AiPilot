import { describe, it, expect, vi, beforeEach } from "vitest";
import { of, throwError } from "rxjs";
import { AiProxyService } from "../../../../src/proxy/ai/ai-proxy.service";
import {
  createHttpServiceMock,
  buildAxiosResponse,
  buildAxiosError,
  type HttpServiceMock,
} from "../../../__support__/mocks/http-service.mock";

/** 测试用 app config（覆盖 AiProxyService 实际访问的字段） */
const TEST_CONFIG = {
  aiServiceUrl: "http://ai.test/",
} as const;

/** 测试用 config 工厂 */
function createConfig(overrides: Record<string, unknown> = {}): never {
  return { ...TEST_CONFIG, ...overrides } as never;
}

describe("AiProxyService", () => {
  let httpService: HttpServiceMock;

  beforeEach(() => {
    httpService = createHttpServiceMock();
  });

  describe("URL 构建", () => {
    it("应该将 path 拼接到 aiServiceUrl 后调用下游", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({ ok: true })),
      );
      const service = new AiProxyService(createConfig(), httpService);

      await service.forwardCapabilities({
        method: "GET",
        path: "/v1/capabilities",
        headers: {},
      });

      const callArgs = vi.mocked(httpService.request).mock.calls[0]?.[0];
      expect(callArgs?.url).toBe("http://ai.test/v1/capabilities");
    });

    it("应该正确处理 base 末尾不带 / 的 aiServiceUrl", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({})),
      );
      const service = new AiProxyService(
        createConfig({ aiServiceUrl: "http://ai.test" }),
        httpService,
      );

      await service.forwardPrompts({
        method: "GET",
        path: "/v1/prompts",
        headers: {},
      });

      const callArgs = vi.mocked(httpService.request).mock.calls[0]?.[0];
      expect(callArgs?.url).toBe("http://ai.test/v1/prompts");
    });

    it("应该处理 base 末尾多个 / 的情况（去尾）", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({})),
      );
      const service = new AiProxyService(
        createConfig({ aiServiceUrl: "http://ai.test///" }),
        httpService,
      );

      await service.forwardSolutions({
        method: "POST",
        path: "/v1/solutions/generate",
        headers: {},
      });

      const callArgs = vi.mocked(httpService.request).mock.calls[0]?.[0];
      expect(callArgs?.url).toBe("http://ai.test/v1/solutions/generate");
    });

    it("path 不以 / 开头时应自动补 /", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({})),
      );
      const service = new AiProxyService(createConfig(), httpService);

      await service.forwardCapabilities({
        method: "GET",
        path: "v1/capabilities",
        headers: {},
      });

      const callArgs = vi.mocked(httpService.request).mock.calls[0]?.[0];
      expect(callArgs?.url).toBe("http://ai.test/v1/capabilities");
    });
  });

  describe("请求配置", () => {
    it("应该将 body/params/headers 透传给 HttpService", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({})),
      );
      const service = new AiProxyService(createConfig(), httpService);
      const headers = { "x-trace-id": "trace-1", authorization: "Bearer x" };
      const body = { prompt: "hello" };
      const query = { page: "1" };

      await service.forwardSolutions({
        method: "POST",
        path: "/v1/solutions/generate",
        body,
        headers,
        query,
      });

      const callArgs = vi.mocked(httpService.request).mock.calls[0]?.[0];
      expect(callArgs?.method).toBe("POST");
      expect(callArgs?.data).toEqual(body);
      expect(callArgs?.params).toEqual(query);
      expect(callArgs?.headers).toEqual(headers);
    });

    it("应该设置 30s 超时", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({})),
      );
      const service = new AiProxyService(createConfig(), httpService);

      await service.forwardPrompts({
        method: "GET",
        path: "/v1/prompts",
        headers: {},
      });

      const callArgs = vi.mocked(httpService.request).mock.calls[0]?.[0];
      expect(callArgs?.timeout).toBe(30_000);
    });

    it("应该设置 validateStatus 始终返回 true（不抛 4xx/5xx）", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({})),
      );
      const service = new AiProxyService(createConfig(), httpService);

      await service.forwardCapabilities({
        method: "GET",
        path: "/v1/capabilities",
        headers: {},
      });

      const callArgs = vi.mocked(httpService.request).mock.calls[0]?.[0];
      expect(callArgs?.validateStatus).toBeInstanceOf(Function);
      expect(callArgs?.validateStatus?.(500)).toBe(true);
      expect(callArgs?.validateStatus?.(404)).toBe(true);
    });

    it("应该禁用重定向（maxRedirects=0）", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({})),
      );
      const service = new AiProxyService(createConfig(), httpService);

      await service.forwardPrompts({
        method: "GET",
        path: "/v1/prompts",
        headers: {},
      });

      const callArgs = vi.mocked(httpService.request).mock.calls[0]?.[0];
      expect(callArgs?.maxRedirects).toBe(0);
    });

    it("应该使用 json 响应类型", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({})),
      );
      const service = new AiProxyService(createConfig(), httpService);

      await service.forwardSolutions({
        method: "POST",
        path: "/v1/solutions/generate",
        headers: {},
      });

      const callArgs = vi.mocked(httpService.request).mock.calls[0]?.[0];
      expect(callArgs?.responseType).toBe("json");
    });

    it("应该克隆 headers 而非直接引用（避免污染原对象）", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({})),
      );
      const service = new AiProxyService(createConfig(), httpService);
      const originalHeaders = { "x-trace-id": "trace-1" };

      await service.forwardCapabilities({
        method: "GET",
        path: "/v1/capabilities",
        headers: originalHeaders,
      });

      const callArgs = vi.mocked(httpService.request).mock.calls[0]?.[0];
      expect(callArgs?.headers).not.toBe(originalHeaders);
      expect(callArgs?.headers).toEqual(originalHeaders);
    });
  });

  describe("ProxyResult 返回", () => {
    it("应该返回 status、data 与过滤后的 headers", async () => {
      const downstreamResponse = buildAxiosResponse(
        { items: [{ id: "p1" }] },
        200,
        {
          etag: '"v1"',
          "content-type": "application/json",
          "content-language": "zh-CN",
          "last-modified": "Wed, 21 Oct 2025 07:28:00 GMT",
          location: "http://ai.test/v1/items/p1",
          "retry-after": "60",
          // 不应透传的 hop-by-hop 头
          "content-length": "123",
          connection: "keep-alive",
        },
      );
      vi.mocked(httpService.request).mockReturnValue(of(downstreamResponse));
      const service = new AiProxyService(createConfig(), httpService);

      const result = await service.forwardCapabilities({
        method: "GET",
        path: "/v1/capabilities",
        headers: {},
      });

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ items: [{ id: "p1" }] });
      // 应保留业务相关头
      expect(result.headers.etag).toBe('"v1"');
      expect(result.headers["content-type"]).toBe("application/json");
      expect(result.headers["content-language"]).toBe("zh-CN");
      expect(result.headers["last-modified"]).toBe(
        "Wed, 21 Oct 2025 07:28:00 GMT",
      );
      expect(result.headers.location).toBe("http://ai.test/v1/items/p1");
      expect(result.headers["retry-after"]).toBe("60");
      // 不应保留 hop-by-hop 头
      expect(result.headers["content-length"]).toBeUndefined();
      expect(result.headers.connection).toBeUndefined();
    });

    it("应该过滤掉空字符串响应头", async () => {
      const downstreamResponse = buildAxiosResponse({}, 200, {
        etag: "",
        "content-type": "application/json",
      });
      vi.mocked(httpService.request).mockReturnValue(of(downstreamResponse));
      const service = new AiProxyService(createConfig(), httpService);

      const result = await service.forwardPrompts({
        method: "GET",
        path: "/v1/prompts",
        headers: {},
      });

      expect(result.headers["content-type"]).toBe("application/json");
      expect(result.headers.etag).toBeUndefined();
    });

    it("应该过滤掉非字符串响应头（如 number）", async () => {
      const downstreamResponse = buildAxiosResponse({}, 200, {
        etag: '"v1"',
        "content-length": 123, // number 类型，应被过滤
      });
      vi.mocked(httpService.request).mockReturnValue(of(downstreamResponse));
      const service = new AiProxyService(createConfig(), httpService);

      const result = await service.forwardSolutions({
        method: "POST",
        path: "/v1/solutions/generate",
        headers: {},
      });

      expect(result.headers.etag).toBe('"v1"');
      expect(result.headers["content-length"]).toBeUndefined();
    });
  });

  describe("三个 forward 方法都委托给 forward()", () => {
    it("forwardCapabilities 应返回 ProxyResult", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({ capabilities: [] }, 200)),
      );
      const service = new AiProxyService(createConfig(), httpService);

      const result = await service.forwardCapabilities({
        method: "GET",
        path: "/v1/capabilities",
        headers: {},
      });

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ capabilities: [] });
    });

    it("forwardPrompts 应返回 ProxyResult", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({ prompts: [] }, 200)),
      );
      const service = new AiProxyService(createConfig(), httpService);

      const result = await service.forwardPrompts({
        method: "GET",
        path: "/v1/prompts",
        headers: {},
      });

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ prompts: [] });
    });

    it("forwardSolutions 应返回 ProxyResult", async () => {
      vi.mocked(httpService.request).mockReturnValue(
        of(buildAxiosResponse({ candidates: [] }, 200)),
      );
      const service = new AiProxyService(createConfig(), httpService);

      const result = await service.forwardSolutions({
        method: "POST",
        path: "/v1/solutions/generate",
        headers: {},
        body: { prompt: "test" },
      });

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ candidates: [] });
    });
  });

  describe("错误处理与日志", () => {
    it("AxiosError 应原样透传并记 warn 日志（含 status）", async () => {
      const axiosError = buildAxiosError(503, { message: "AI 服务降级" });
      vi.mocked(httpService.request).mockReturnValue(
        throwError(() => axiosError),
      );
      const service = new AiProxyService(createConfig(), httpService);
      const warnSpy = vi
        .spyOn(service["logger"], "warn")
        .mockImplementation(() => undefined);
      const errorSpy = vi
        .spyOn(service["logger"], "error")
        .mockImplementation(() => undefined);

      await expect(
        service.forwardCapabilities({
          method: "GET",
          path: "/v1/capabilities",
          headers: { "x-trace-id": "trace-err" },
        }),
      ).rejects.toBe(axiosError);

      // 应记 warn 日志（AxiosError 走 warn 分支）
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
      const logMsg = warnSpy.mock.calls[0]?.[0] as string;
      expect(logMsg).toContain("method=GET");
      expect(logMsg).toContain("status=503");
      expect(logMsg).toContain("traceId=trace-err");
    });

    it("AxiosError 无 response.status 时应记 status=n/a", async () => {
      const axiosError = buildAxiosError(500, {});
      // 删除 response.status
      delete (axiosError as { response?: { status?: number } }).response
        ?.status;
      vi.mocked(httpService.request).mockReturnValue(
        throwError(() => axiosError),
      );
      const service = new AiProxyService(createConfig(), httpService);
      const warnSpy = vi
        .spyOn(service["logger"], "warn")
        .mockImplementation(() => undefined);

      await expect(
        service.forwardPrompts({
          method: "POST",
          path: "/v1/prompts",
          headers: {},
        }),
      ).rejects.toBe(axiosError);

      const logMsg = warnSpy.mock.calls[0]?.[0] as string;
      expect(logMsg).toContain("status=n/a");
    });

    it("非 AxiosError（普通 Error）应记 error 日志", async () => {
      const error = new Error("连接超时");
      vi.mocked(httpService.request).mockReturnValue(throwError(() => error));
      const service = new AiProxyService(createConfig(), httpService);
      const warnSpy = vi
        .spyOn(service["logger"], "warn")
        .mockImplementation(() => undefined);
      const errorSpy = vi
        .spyOn(service["logger"], "error")
        .mockImplementation(() => undefined);

      await expect(
        service.forwardSolutions({
          method: "POST",
          path: "/v1/solutions/generate",
          headers: {},
        }),
      ).rejects.toBe(error);

      // 非 AxiosError 走 error 分支
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
      const logMsg = errorSpy.mock.calls[0]?.[0] as string;
      expect(logMsg).toContain("AI服务调用异常");
      expect(logMsg).toContain("method=POST");
    });

    it("traceId 应从 headers['x-trace-id'] 提取（string 类型）", async () => {
      const axiosError = buildAxiosError(500, {});
      vi.mocked(httpService.request).mockReturnValue(
        throwError(() => axiosError),
      );
      const service = new AiProxyService(createConfig(), httpService);
      const warnSpy = vi
        .spyOn(service["logger"], "warn")
        .mockImplementation(() => undefined);

      await expect(
        service.forwardCapabilities({
          method: "GET",
          path: "/v1/capabilities",
          headers: { "x-trace-id": "trace-from-header" },
        }),
      ).rejects.toBe(axiosError);

      const logMsg = warnSpy.mock.calls[0]?.[0] as string;
      expect(logMsg).toContain("traceId=trace-from-header");
    });

    it("traceId 应从 headers['x-trace-id'] 数组中取第一个", async () => {
      const axiosError = buildAxiosError(500, {});
      vi.mocked(httpService.request).mockReturnValue(
        throwError(() => axiosError),
      );
      const service = new AiProxyService(createConfig(), httpService);
      const warnSpy = vi
        .spyOn(service["logger"], "warn")
        .mockImplementation(() => undefined);

      await expect(
        service.forwardPrompts({
          method: "GET",
          path: "/v1/prompts",
          headers: { "x-trace-id": ["trace-arr-1", "trace-arr-2"] },
        }),
      ).rejects.toBe(axiosError);

      const logMsg = warnSpy.mock.calls[0]?.[0] as string;
      expect(logMsg).toContain("traceId=trace-arr-1");
    });

    it("traceId 缺失时应记 traceId=unknown", async () => {
      const axiosError = buildAxiosError(500, {});
      vi.mocked(httpService.request).mockReturnValue(
        throwError(() => axiosError),
      );
      const service = new AiProxyService(createConfig(), httpService);
      const warnSpy = vi
        .spyOn(service["logger"], "warn")
        .mockImplementation(() => undefined);

      await expect(
        service.forwardSolutions({
          method: "POST",
          path: "/v1/solutions/generate",
          headers: {},
        }),
      ).rejects.toBe(axiosError);

      const logMsg = warnSpy.mock.calls[0]?.[0] as string;
      expect(logMsg).toContain("traceId=unknown");
    });

    it("x-trace-id 为空数组时应记 traceId=unknown", async () => {
      const axiosError = buildAxiosError(500, {});
      vi.mocked(httpService.request).mockReturnValue(
        throwError(() => axiosError),
      );
      const service = new AiProxyService(createConfig(), httpService);
      const warnSpy = vi
        .spyOn(service["logger"], "warn")
        .mockImplementation(() => undefined);

      await expect(
        service.forwardCapabilities({
          method: "GET",
          path: "/v1/capabilities",
          headers: { "x-trace-id": [] },
        }),
      ).rejects.toBe(axiosError);

      const logMsg = warnSpy.mock.calls[0]?.[0] as string;
      expect(logMsg).toContain("traceId=unknown");
    });
  });
});
