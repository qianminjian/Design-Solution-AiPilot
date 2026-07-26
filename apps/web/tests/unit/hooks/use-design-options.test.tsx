/**
 * useDesignOptions & useDesignFeedback hooks 单元测试
 *
 * 验证：
 *  - useDesignOptions 调用 apiGet 时传入 schema 软验证配置
 *  - useDesignOption 在 optionId 为空时禁用查询
 *  - useCreateDesignOption 携带 projectId 并失效 list 缓存
 *  - useDesignFeedback 调用 apiGet 并传入 array schema
 *  - useSubmitDesignFeedback 调用 apiPost 并失效 feedback 缓存
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return { ...actual };
});

import {
  useDesignOptions,
  useDesignOption,
  useCreateDesignOption,
  useDesignFeedback,
  useSubmitDesignFeedback,
} from "@/hooks/use-design-options";

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

describe("useDesignOptions hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 schema 软验证配置", async () => {
    const mockPage = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    };
    mockApiGet.mockResolvedValue(mockPage);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useDesignOptions("proj-001", { page: 1, pageSize: 20 }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    const [path, options] = mockApiGet.mock.calls[0] as [
      string,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path).toContain("/api/v1/design-options");
    expect(path).toContain("projectId=proj-001");
    expect(path).toContain("page=1");
    expect(path).toContain("pageSize=20");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useDesignOptions.list");
  });

  it("status 与 discipline 参数应拼接到 URL", async () => {
    mockApiGet.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useDesignOptions("proj-001", {
          status: "DRAFT",
          discipline: "ARCHITECTURE",
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const [path] = mockApiGet.mock.calls[0] as [string];
    expect(path).toContain("status=DRAFT");
    expect(path).toContain("discipline=ARCHITECTURE");
  });

  it("projectId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDesignOptions(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("projectId 为空字符串时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDesignOptions(""), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useDesignOption hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 schema 软验证配置", async () => {
    const mockOption = {
      id: "opt-001",
      projectId: "proj-001",
      title: "方案 A",
      status: "DRAFT",
      discipline: "ARCHITECTURE",
      version: 1,
      rowVersion: 1,
    };
    mockApiGet.mockResolvedValue(mockOption);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDesignOption("opt-001"), {
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
    expect(path).toBe("/api/v1/design-options/opt-001");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useDesignOptions.detail");
  });

  it("optionId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDesignOption(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("optionId 为空字符串时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDesignOption(""), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useCreateDesignOption hook", () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  it("应该调用 apiPost 携带 projectId 并失效 list 缓存", async () => {
    const created = {
      id: "opt-001",
      projectId: "proj-001",
      title: "方案 A",
      status: "DRAFT",
      discipline: "ARCHITECTURE",
      version: 1,
      rowVersion: 1,
    };
    mockApiPost.mockResolvedValue(created);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateDesignOption("proj-001"), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      title: "方案 A",
      description: "测试方案",
      discipline: "ARCHITECTURE",
    });

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    const [path, payload, options] = mockApiPost.mock.calls[0] as [
      string,
      unknown,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path).toBe("/api/v1/design-options");
    // projectId 应自动注入到 payload
    expect(payload).toMatchObject({
      projectId: "proj-001",
      title: "方案 A",
      discipline: "ARCHITECTURE",
    });
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useDesignOptions.create");

    await waitFor(() => {
      const calls = invalidateSpy.mock.calls;
      const hasListInvalidation = calls.some((call) => {
        const arg = call[0];
        return (
          arg &&
          typeof arg === "object" &&
          "queryKey" in arg &&
          Array.isArray(arg.queryKey) &&
          arg.queryKey.includes("list")
        );
      });
      expect(hasListInvalidation).toBe(true);
    });
  });
});

describe("useDesignFeedback hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 array schema 软验证配置", async () => {
    const feedback = [
      {
        id: "fb-001",
        optionId: "opt-001",
        comment: "方案合理",
        rating: 5,
        createdBy: "user-1",
        createdAt: "2026-07-26T10:00:00Z",
      },
    ];
    mockApiGet.mockResolvedValue(feedback);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDesignFeedback("opt-001"), {
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
    expect(path).toBe("/api/v1/design-options/opt-001/feedback");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useDesignOptions.feedback");
  });

  it("optionId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDesignFeedback(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useSubmitDesignFeedback hook", () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  it("应该调用 apiPost 提交反馈并失效 feedback 缓存", async () => {
    const created = {
      id: "fb-001",
      optionId: "opt-001",
      comment: "方案合理",
      rating: 5,
      createdBy: "user-1",
      createdAt: "2026-07-26T10:00:00Z",
    };
    mockApiPost.mockResolvedValue(created);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSubmitDesignFeedback(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      optionId: "opt-001",
      comment: "方案合理",
      rating: 5,
    });

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    const [path, payload, options] = mockApiPost.mock.calls[0] as [
      string,
      unknown,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path).toBe("/api/v1/design-options/opt-001/feedback");
    expect(payload).toMatchObject({ comment: "方案合理", rating: 5 });
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useDesignOptions.submitFeedback");

    await waitFor(() => {
      const calls = invalidateSpy.mock.calls;
      const hasFeedbackInvalidation = calls.some((call) => {
        const arg = call[0];
        return (
          arg &&
          typeof arg === "object" &&
          "queryKey" in arg &&
          Array.isArray(arg.queryKey) &&
          arg.queryKey.includes("feedback")
        );
      });
      expect(hasFeedbackInvalidation).toBe(true);
    });
  });
});
