/**
 * useStages & useGates hooks 单元测试
 *
 * 验证：
 *  - useStages 调用 apiGet 时传入 schema 软验证配置，并按 stageOrder 排序
 *  - useStages 在 projectId 为空时禁用查询
 *  - useGates 调用 apiGet 时传入 schema 软验证配置
 *  - useGates 在 stageId 为空时禁用查询
 *  - useDecideGate 调用 apiPost 并失效 gates 缓存
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

import { useStages } from "@/hooks/use-stages";
import { useGates, useDecideGate } from "@/hooks/use-gates";

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

describe("useStages hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 array schema 软验证配置", async () => {
    const stages = [
      {
        id: "stage-2",
        stageCode: "STG-P1",
        stageName: "方案设计",
        stageOrder: 2,
        status: "planned",
        projectId: "proj-001",
        rowVersion: 1,
      },
      {
        id: "stage-1",
        stageCode: "STG-P0",
        stageName: "前期策划",
        stageOrder: 1,
        status: "active",
        projectId: "proj-001",
        rowVersion: 1,
      },
    ];
    mockApiGet.mockResolvedValue(stages);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStages("proj-001"), {
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
    expect(path).toBe("/api/v1/workflow/stages?projectId=proj-001");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useStages.list");
  });

  it("应按 stageOrder 升序排列返回结果", async () => {
    const stagesUnsorted = [
      {
        id: "stage-3",
        stageCode: "STG-P2",
        stageName: "扩初",
        stageOrder: 3,
        status: "planned",
        projectId: "proj-001",
        rowVersion: 1,
      },
      {
        id: "stage-1",
        stageCode: "STG-P0",
        stageName: "前期",
        stageOrder: 1,
        status: "active",
        projectId: "proj-001",
        rowVersion: 1,
      },
      {
        id: "stage-2",
        stageCode: "STG-P1",
        stageName: "方案",
        stageOrder: 2,
        status: "planned",
        projectId: "proj-001",
        rowVersion: 1,
      },
    ];
    mockApiGet.mockResolvedValue(stagesUnsorted);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStages("proj-001"), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(data).toBeDefined();
    expect(data?.[0]?.stageOrder).toBe(1);
    expect(data?.[1]?.stageOrder).toBe(2);
    expect(data?.[2]?.stageOrder).toBe(3);
  });

  it("projectId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStages(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("projectId 为空字符串时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStages(""), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useGates hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该调用 apiGet 并传入 array schema 软验证配置", async () => {
    const gates = [
      {
        id: "gate-1",
        gateCode: "G1",
        gateName: "方案门禁",
        status: "pending",
        projectId: "proj-001",
        stageId: "stage-1",
        rowVersion: 1,
      },
    ];
    mockApiGet.mockResolvedValue(gates);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useGates("stage-1"), {
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
    expect(path).toBe("/api/v1/workflow/gates?stageId=stage-1");
    expect(options.validate.schema).toBeDefined();
    expect(options.validate.context).toBe("useGates.list");
  });

  it("stageId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useGates(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("stageId 为空字符串时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useGates(""), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

describe("useDecideGate hook", () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  it("应该调用 apiPost 提交决策并失效 gates 缓存", async () => {
    mockApiPost.mockResolvedValue(undefined);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDecideGate(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      gateId: "gate-1",
      payload: {
        decision: "approved",
        comment: "通过",
        baselineId: "baseline-1",
      },
    });

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    const [path, payload] = mockApiPost.mock.calls[0] as [string, unknown];
    expect(path).toBe("/api/v1/workflow/gates/gate-1:decide");
    expect(payload).toMatchObject({ decision: "approved" });

    await waitFor(() => {
      // 应失效 gates 缓存
      const calls = invalidateSpy.mock.calls;
      const hasGatesInvalidation = calls.some((call) => {
        const arg = call[0];
        return (
          arg &&
          typeof arg === "object" &&
          "queryKey" in arg &&
          Array.isArray(arg.queryKey) &&
          arg.queryKey.includes("gates")
        );
      });
      expect(hasGatesInvalidation).toBe(true);
    });
  });
});
