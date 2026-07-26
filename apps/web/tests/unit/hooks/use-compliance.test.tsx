/**
 * useCompliance* hooks 单元测试
 *
 * 覆盖核心 hooks：
 *  - useComplianceRules / useComplianceRule（查询）
 *  - useCreateComplianceRule / useUpdateComplianceRule / useDeleteComplianceRule（mutation）
 *  - useRuleRevisions
 *
 * 验证：
 *  - apiGet/apiPost/apiPatch/apiDelete 调用契约
 *  - schema 软验证配置（context 与 schema 字段）
 *  - 缓存失效行为
 *  - enabled 守卫
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockApiGet, mockApiPost, mockApiPatch, mockApiDelete } = vi.hoisted(
  () => ({
    mockApiGet: vi.fn(),
    mockApiPost: vi.fn(),
    mockApiPatch: vi.fn(),
    mockApiDelete: vi.fn(),
  }),
);
vi.mock("@/lib/api-client", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return { ...actual };
});

import {
  useComplianceRules,
  useComplianceRule,
  useCreateComplianceRule,
  useUpdateComplianceRule,
  useDeleteComplianceRule,
  useRuleRevisions,
} from "@/hooks/use-compliance";

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

describe("useComplianceRules hook", () => {
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
      () => useComplianceRules({ page: 1, pageSize: 20 }),
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
    expect(path).toContain("/api/v1/compliance-rules");
    expect(path).toContain("page=1");
    expect(path).toContain("pageSize=20");
    expect(path).toContain("order=desc");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useComplianceRules.list");
  });

  it("category 与 status 参数应拼接到 URL", async () => {
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
        useComplianceRules({
          category: "FIRE_SAFETY",
          status: "ACTIVE",
          order: "asc",
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const [path] = mockApiGet.mock.calls[0] as [string];
    expect(path).toContain("category=FIRE_SAFETY");
    expect(path).toContain("status=ACTIVE");
    expect(path).toContain("order=asc");
  });
});

describe("useComplianceRule hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 schema 软验证配置", async () => {
    const mockRule = {
      id: "rule-001",
      ruleCode: "FIRE-001",
      title: "消防疏散",
      category: "FIRE_SAFETY",
      status: "ACTIVE",
      severity: "high",
      version: 1,
      rowVersion: 1,
    };
    mockApiGet.mockResolvedValue(mockRule);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useComplianceRule("rule-001"), {
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
    expect(path).toBe("/api/v1/compliance-rules/rule-001");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useComplianceRule.detail");
  });

  it("id 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useComplianceRule(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("id 为空字符串时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useComplianceRule(""), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useCreateComplianceRule hook", () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  it("应该调用 apiPost 并失效 rules list 缓存", async () => {
    const created = {
      id: "rule-001",
      ruleCode: "FIRE-001",
      title: "消防疏散",
      category: "FIRE_SAFETY",
      status: "ACTIVE",
      severity: "high",
      version: 1,
      rowVersion: 1,
    };
    mockApiPost.mockResolvedValue(created);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateComplianceRule(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      ruleCode: "FIRE-001",
      name: "消防疏散",
      category: "FIRE_SAFETY",
    });

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    const [path, payload, options] = mockApiPost.mock.calls[0] as [
      string,
      unknown,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path).toBe("/api/v1/compliance-rules");
    expect(payload).toMatchObject({ ruleCode: "FIRE-001" });
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useCreateComplianceRule");

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

describe("useUpdateComplianceRule hook", () => {
  beforeEach(() => {
    mockApiPatch.mockReset();
  });

  it("应该调用 apiPatch 并失效 list+detail 缓存", async () => {
    const updated = {
      id: "rule-001",
      ruleCode: "FIRE-001",
      title: "消防疏散（修订）",
      category: "FIRE_SAFETY",
      status: "ACTIVE",
      severity: "high",
      version: 1,
      rowVersion: 2,
    };
    mockApiPatch.mockResolvedValue(updated);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateComplianceRule(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      id: "rule-001",
      data: { name: "消防疏散（修订）" },
    });

    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    const [path, payload, options] = mockApiPatch.mock.calls[0] as [
      string,
      unknown,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path).toBe("/api/v1/compliance-rules/rule-001");
    expect(payload).toMatchObject({ name: "消防疏散（修订）" });
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useUpdateComplianceRule");

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
      const hasDetailInvalidation = calls.some((call) => {
        const arg = call[0];
        return (
          arg &&
          typeof arg === "object" &&
          "queryKey" in arg &&
          Array.isArray(arg.queryKey) &&
          arg.queryKey.includes("detail")
        );
      });
      expect(hasListInvalidation).toBe(true);
      expect(hasDetailInvalidation).toBe(true);
    });
  });
});

describe("useDeleteComplianceRule hook", () => {
  beforeEach(() => {
    mockApiDelete.mockReset();
  });

  it("应该调用 apiDelete 并失效 rules list 缓存", async () => {
    mockApiDelete.mockResolvedValue(undefined);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteComplianceRule(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync("rule-001");

    expect(mockApiDelete).toHaveBeenCalledTimes(1);
    const [path] = mockApiDelete.mock.calls[0] as [string];
    expect(path).toBe("/api/v1/compliance-rules/rule-001");

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

describe("useRuleRevisions hook", () => {
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
      () => useRuleRevisions("rule-001", { page: 1, pageSize: 20 }),
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
    expect(path).toContain("/api/v1/compliance-rules/rule-001/revisions");
    expect(path).toContain("page=1");
    expect(path).toContain("pageSize=20");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useRuleRevisions.list");
  });

  it("ruleId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRuleRevisions(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("order 参数默认为 desc", async () => {
    mockApiGet.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useRuleRevisions("rule-001"), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const [path] = mockApiGet.mock.calls[0] as [string];
    expect(path).toContain("order=desc");
  });
});
