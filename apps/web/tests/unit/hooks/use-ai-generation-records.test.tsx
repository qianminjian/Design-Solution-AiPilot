/**
 * useAiGenerationRecord* hooks 单元测试
 *
 * AI 安全红线相关：所有 hooks 必须使用 strict: true 严格验证模式
 *
 * 验证：
 *  - useAiGenerationRecord 调用 apiGet 并传入 schema 严格验证配置（strict: true）
 *  - useAiGenerationRecordsByDesignOption / ByProject 严格模式
 *  - usePendingAiReviews 严格模式 + projectId 守卫
 *  - useSubmitAiReview 严格模式 + 缓存失效（pending-reviews + detail + by-project）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockApiGet, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return { ...actual };
});

import {
  useAiGenerationRecord,
  useAiGenerationRecordsByDesignOption,
  useAiGenerationRecordsByProject,
  usePendingAiReviews,
  useSubmitAiReview,
} from "@/hooks/use-ai-generation-records";

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

describe("useAiGenerationRecord hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 strict:true 严格验证配置", async () => {
    const mockRecord = {
      id: "ai-001",
      projectId: "proj-001",
      designOptionId: null,
      generationType: "concept-generation",
      renderedPrompt: "prompt",
      rawContent: "content",
      provider: "openai",
      model: "gpt-4o",
      isAiAssisted: true,
      requiresHumanReview: true,
      riskLevel: "medium",
      reviewStatus: "PENDING",
      rowVersion: 1,
    };
    mockApiGet.mockResolvedValue(mockRecord);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAiGenerationRecord("ai-001"), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    const [path, options] = mockApiGet.mock.calls[0] as [
      string,
      {
        validate: {
          schema: unknown;
          context: string;
          strict?: boolean;
        };
      },
    ];
    expect(path).toBe("/api/v1/ai-generation-records/ai-001");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useAiGenerationRecord.detail");
    // AI 安全红线：必须使用严格模式
    expect(options.validate.strict).toBe(true);
  });

  it("id 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAiGenerationRecord(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("id 为空字符串时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAiGenerationRecord(""), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useAiGenerationRecordsByDesignOption hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 strict:true 严格验证配置", async () => {
    mockApiGet.mockResolvedValue([]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAiGenerationRecordsByDesignOption("opt-001"),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    const [path, options] = mockApiGet.mock.calls[0] as [
      string,
      {
        validate: {
          schema: unknown;
          context: string;
          strict?: boolean;
        };
      },
    ];
    expect(path).toContain("/api/v1/ai-generation-records");
    expect(path).toContain("designOptionId=opt-001");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe(
      "useAiGenerationRecords.byDesignOption",
    );
    expect(options.validate.strict).toBe(true);
  });

  it("designOptionId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAiGenerationRecordsByDesignOption(null),
      { wrapper: Wrapper },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useAiGenerationRecordsByProject hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 strict:true 严格验证配置", async () => {
    mockApiGet.mockResolvedValue([]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAiGenerationRecordsByProject("proj-001"),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    const [path, options] = mockApiGet.mock.calls[0] as [
      string,
      {
        validate: {
          schema: unknown;
          context: string;
          strict?: boolean;
        };
      },
    ];
    expect(path).toContain("/api/v1/ai-generation-records");
    expect(path).toContain("projectId=proj-001");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useAiGenerationRecords.byProject");
    expect(options.validate.strict).toBe(true);
  });

  it("projectId 为空时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useAiGenerationRecordsByProject(""), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("usePendingAiReviews hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 strict:true 严格验证配置", async () => {
    mockApiGet.mockResolvedValue([]);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePendingAiReviews("proj-001"), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    const [path, options] = mockApiGet.mock.calls[0] as [
      string,
      {
        validate: {
          schema: unknown;
          context: string;
          strict?: boolean;
        };
      },
    ];
    expect(path).toContain("/api/v1/ai-generation-records/reviews/pending");
    expect(path).toContain("projectId=proj-001");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("usePendingAiReviews.list");
    expect(options.validate.strict).toBe(true);
  });

  it("projectId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePendingAiReviews(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useSubmitAiReview hook", () => {
  beforeEach(() => {
    mockApiPatch.mockReset();
  });

  it("应该调用 apiPatch 提交复核并失效 pending-reviews + detail + by-project 缓存", async () => {
    const updated = {
      id: "ai-001",
      projectId: "proj-001",
      designOptionId: null,
      generationType: "concept-generation",
      renderedPrompt: "prompt",
      rawContent: "content",
      provider: "openai",
      model: "gpt-4o",
      isAiAssisted: true,
      requiresHumanReview: true,
      riskLevel: "medium",
      reviewStatus: "APPROVED",
      rowVersion: 2,
    };
    mockApiPatch.mockResolvedValue(updated);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSubmitAiReview(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      id: "ai-001",
      payload: {
        decision: "APPROVED",
        comment: "通过",
      },
    });

    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    const [path, payload, options] = mockApiPatch.mock.calls[0] as [
      string,
      unknown,
      {
        validate: {
          schema: unknown;
          context: string;
          strict?: boolean;
        };
      },
    ];
    expect(path).toBe("/api/v1/ai-generation-records/ai-001/review");
    expect(payload).toMatchObject({ decision: "APPROVED" });
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useSubmitAiReview");
    expect(options.validate.strict).toBe(true);

    await waitFor(() => {
      const calls = invalidateSpy.mock.calls;
      // 应同时失效 pending-reviews、detail、by-project 三个查询键
      const hasPendingReviews = calls.some((call) => {
        const arg = call[0];
        return (
          arg &&
          typeof arg === "object" &&
          "queryKey" in arg &&
          Array.isArray(arg.queryKey) &&
          arg.queryKey.includes("pending-reviews")
        );
      });
      const hasDetail = calls.some((call) => {
        const arg = call[0];
        return (
          arg &&
          typeof arg === "object" &&
          "queryKey" in arg &&
          Array.isArray(arg.queryKey) &&
          arg.queryKey.includes("detail")
        );
      });
      const hasByProject = calls.some((call) => {
        const arg = call[0];
        return (
          arg &&
          typeof arg === "object" &&
          "queryKey" in arg &&
          Array.isArray(arg.queryKey) &&
          arg.queryKey.includes("by-project")
        );
      });
      expect(hasPendingReviews).toBe(true);
      expect(hasDetail).toBe(true);
      expect(hasByProject).toBe(true);
    });
  });
});
