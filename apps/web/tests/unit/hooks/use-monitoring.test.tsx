/**
 * useMonitoring hooks 单元测试
 *
 * 验证：
 *  - useHealth 调用 apiGet 并传入 schema 软验证配置
 *  - useMetrics 调用 fetch 并返回 text/plain 内容
 *  - useMetrics 在响应失败时抛出错误
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));
vi.stubGlobal("fetch", mockFetch);

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return { ...actual };
});

import { useHealth, useMetrics } from "@/hooks/use-monitoring";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { queryClient, Wrapper };
}

describe("useHealth hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 schema 软验证配置", async () => {
    const mockHealth = {
      status: "ok",
      timestamp: "2026-07-26T10:00:00Z",
      services: {
        database: "connected",
        storage: "connected",
      },
    };
    mockApiGet.mockResolvedValue(mockHealth);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useHealth(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    const [path, options] = mockApiGet.mock.calls[0] as [
      string,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path).toBe("/api/v1/health");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useMonitoring.health");
  });

  it("返回的数据应包含 status 字段", async () => {
    const mockHealth = {
      status: "ok",
      timestamp: "2026-07-26T10:00:00Z",
      services: { database: "connected" },
    };
    mockApiGet.mockResolvedValue(mockHealth);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useHealth(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.status).toBe("ok");
  });
});

describe("useMetrics hook", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("应该调用 fetch 并返回 text/plain 内容", async () => {
    const metricsText =
      '# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total{method="get"} 100\n';
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(metricsText),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMetrics(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [path] = mockFetch.mock.calls[0] as [string];
    expect(path).toBe("/api/v1/metrics");
    expect(result.current.data).toBe(metricsText);
  });

  it("响应失败时应抛出错误", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(""),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMetrics(), {
      wrapper: Wrapper,
    });

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain("指标获取失败");
  });
});
