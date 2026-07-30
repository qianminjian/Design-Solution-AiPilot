/**
 * useReview hooks 单元测试
 *
 * 覆盖核心 hooks：
 *  - useComplianceCheck / useFindings / useGateSummary / useBcfIssues（查询）
 *  - useUpdateBcfIssueStatus / useAssignBcfIssue（mutation + 缓存失效）
 *
 * 验证：
 *  - apiGet/apiPatch 调用契约
 *  - schema 软验证配置（context 与 schema 字段）
 *  - enabled 守卫
 *  - 缓存失效行为
 *
 * 说明：RAG 检索问答 hook（useRagQuery）已迁移至 @/hooks/use-rag.ts
 *  - 路径：POST /api/v1/rag/query（对齐 services/ai/src/rag/router.py）
 *  - 测试见 tests/unit/hooks/use-rag.test.ts
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
  useComplianceCheck,
  useFindings,
  useGateSummary,
  useBcfIssues,
  useUpdateBcfIssueStatus,
  useAssignBcfIssue,
} from "@/hooks/use-review";

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

describe("useComplianceCheck hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 schema 软验证配置", async () => {
    const mockCheckRun = {
      id: "run-001",
      projectId: "proj-001",
      status: "completed",
      totalRules: 10,
      passedCount: 8,
      failedCount: 2,
      skippedCount: 0,
      startedAt: "2026-07-26T10:00:00Z",
      completedAt: "2026-07-26T10:05:00Z",
      rowVersion: 1,
    };
    mockApiGet.mockResolvedValue(mockCheckRun);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useComplianceCheck("proj-001"), {
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
    expect(path).toBe("/api/v1/projects/proj-001/compliance-check");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useReview.complianceCheck");
  });

  it("projectId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useComplianceCheck(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useFindings hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 array schema 软验证配置", async () => {
    const mockFindings = [
      {
        id: "finding-001",
        projectId: "proj-001",
        ruleId: "rule-001",
        severity: "high",
        status: "pending",
        description: "未满足消防疏散要求",
      },
    ];
    mockApiGet.mockResolvedValue(mockFindings);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFindings("proj-001"), {
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
    expect(path).toBe("/api/v1/projects/proj-001/findings");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useReview.findings");
  });

  it("projectId 为空字符串时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useFindings(""), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useGateSummary hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 schema 软验证配置", async () => {
    const mockSummary = {
      projectId: "proj-001",
      totalGates: 3,
      approvedGates: 1,
      pendingGates: 2,
      reworkGates: 0,
      suspendedGates: 0,
      lastUpdated: "2026-07-26T10:00:00Z",
    };
    mockApiGet.mockResolvedValue(mockSummary);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useGateSummary("proj-001"), {
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
    expect(path).toBe("/api/v1/projects/proj-001/review/gate-summary");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useReview.gateSummary");
  });

  it("projectId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useGateSummary(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useBcfIssues hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 array schema 软验证配置", async () => {
    const mockIssues = [
      {
        id: "issue-001",
        projectId: "proj-001",
        title: "结构碰撞",
        status: "OPEN",
        priority: "HIGH",
        assignee: "user-1",
        createdAt: "2026-07-26T10:00:00Z",
      },
    ];
    mockApiGet.mockResolvedValue(mockIssues);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBcfIssues("proj-001"), {
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
    expect(path).toBe("/api/v1/projects/proj-001/coordination/issues");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useReview.bcfIssues");
  });

  it("projectId 为空时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBcfIssues(""), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useUpdateBcfIssueStatus hook", () => {
  beforeEach(() => {
    mockApiPatch.mockReset();
  });

  it("应该调用 apiPatch 并失效 bcf-issues 缓存", async () => {
    mockApiPatch.mockResolvedValue(undefined);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateBcfIssueStatus(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      issueId: "issue-001",
      status: "in_progress",
    });

    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    const [path, payload] = mockApiPatch.mock.calls[0] as [string, unknown];
    expect(path).toBe("/api/v1/coordination/issues/issue-001/status");
    expect(payload).toMatchObject({ status: "in_progress" });

    await waitFor(() => {
      const calls = invalidateSpy.mock.calls;
      const hasBcfInvalidation = calls.some((call) => {
        const arg = call[0];
        return (
          arg &&
          typeof arg === "object" &&
          "queryKey" in arg &&
          Array.isArray(arg.queryKey) &&
          arg.queryKey.includes("bcf-issues")
        );
      });
      expect(hasBcfInvalidation).toBe(true);
    });
  });
});

describe("useAssignBcfIssue hook", () => {
  beforeEach(() => {
    mockApiPatch.mockReset();
  });

  it("应该调用 apiPatch 指派并失效 bcf-issues 缓存", async () => {
    mockApiPatch.mockResolvedValue(undefined);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAssignBcfIssue(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      issueId: "issue-001",
      assignee: "user-2",
    });

    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    const [path, payload] = mockApiPatch.mock.calls[0] as [string, unknown];
    expect(path).toBe("/api/v1/coordination/issues/issue-001/assign");
    expect(payload).toMatchObject({ assignee: "user-2" });

    await waitFor(() => {
      const calls = invalidateSpy.mock.calls;
      const hasBcfInvalidation = calls.some((call) => {
        const arg = call[0];
        return (
          arg &&
          typeof arg === "object" &&
          "queryKey" in arg &&
          Array.isArray(arg.queryKey) &&
          arg.queryKey.includes("bcf-issues")
        );
      });
      expect(hasBcfInvalidation).toBe(true);
    });
  });
});
