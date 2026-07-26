/**
 * useProjectDetail hook 单元测试
 *
 * 验证：
 *  - 并行调用 apiGet 两次（项目详情 + 阶段列表）
 *  - 阶段按 stageOrder 升序排列
 *  - projectId 为空时禁用查询
 *  - 两个请求的 schema 软验证配置正确
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

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return { ...actual };
});

import { useProjectDetail } from "@/hooks/use-project-detail";

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

describe("useProjectDetail hook", () => {
  beforeEach(() => {
    mockApiGet.mockReset();
  });

  it("应该并行调用 apiGet 两次（项目详情 + 阶段列表）", async () => {
    const mockProject = {
      id: "proj-001",
      code: "P001",
      name: "测试项目",
      status: "active",
      buildingType: "office",
      floorsMin: 5,
      floorsMax: 15,
      region: "us-east-1",
      language: "en",
      classification: "PROJECT_RECORD",
      rowVersion: 1,
    };
    const mockStages = [
      {
        id: "stage-1",
        stageCode: "STG-P0",
        stageName: "前期",
        stageOrder: 1,
        status: "active",
        projectId: "proj-001",
        rowVersion: 1,
      },
    ];
    mockApiGet
      .mockResolvedValueOnce(mockProject)
      .mockResolvedValueOnce(mockStages);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProjectDetail("proj-001"), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiGet).toHaveBeenCalledTimes(2);
    // 第一次调用：项目详情
    const [path1, options1] = mockApiGet.mock.calls[0] as [
      string,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path1).toBe("/api/v1/projects/proj-001");
    expect(options1.validate.schema).toBeDefined();
    expect(options1.validate.context).toBe("useProjectDetail.project");

    // 第二次调用：阶段列表
    const [path2, options2] = mockApiGet.mock.calls[1] as [
      string,
      { validate: { schema: unknown; context: string } },
    ];
    expect(path2).toContain("/api/v1/workflow/stages");
    expect(path2).toContain("projectId=proj-001");
    expect(options2.validate.schema).toBeDefined();
    expect(options2.validate.context).toBe("useProjectDetail.stages");
  });

  it("阶段应按 stageOrder 升序排列", async () => {
    const mockProject = {
      id: "proj-001",
      code: "P001",
      name: "测试",
      status: "active",
      buildingType: "office",
      floorsMin: 5,
      floorsMax: 15,
      region: "us-east-1",
      language: "en",
      classification: "PROJECT_RECORD",
      rowVersion: 1,
    };
    const mockStagesUnsorted = [
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
    mockApiGet
      .mockResolvedValueOnce(mockProject)
      .mockResolvedValueOnce(mockStagesUnsorted);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProjectDetail("proj-001"), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(data).toBeDefined();
    expect(data?.stages).toHaveLength(3);
    expect(data?.stages?.[0]?.stageOrder).toBe(1);
    expect(data?.stages?.[1]?.stageOrder).toBe(2);
    expect(data?.stages?.[2]?.stageOrder).toBe(3);
  });

  it("projectId 为 null 时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProjectDetail(null), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("projectId 为空字符串时应禁用查询", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProjectDetail(""), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
