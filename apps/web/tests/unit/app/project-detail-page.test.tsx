/**
 * ProjectDetailPage 单元测试
 *
 * 验证：
 *  - 加载中状态：渲染 Spin（size="large"）
 *  - 错误状态：渲染 DataErrorAlert（variant="result"，context="项目"）
 *  - 成功状态：渲染 ProjectHeader、StageTimeline、GateDecisionList
 *  - 顶部操作栏：返回项目列表按钮、设计选项/文档库/多专业协调按钮
 *  - 点击按钮跳转正确路径
 *  - data 缺失时也走错误分支
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Suspense } from "react";
import "@testing-library/jest-dom/vitest";

// 缓存 Promise 解析结果，使 React 19 use() 可同步取值
// Promise.then 是微任务，无法同步取值，故预先在创建 Promise 时缓存值
type ResolvedPromise<T> = Promise<T> & { __resolvedValue?: T };

function createSyncResolvedPromise<T>(value: T): ResolvedPromise<T> {
  const p: ResolvedPromise<T> = Promise.resolve(value) as ResolvedPromise<T>;
  p.__resolvedValue = value;
  return p;
}

// Mock React 19 use() 以同步方式解包 Promise params，避免 jsdom 中 Suspense 边界无法解除
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    use: <T,>(resource: Promise<T> | T): T => {
      if (
        resource !== null &&
        typeof resource === "object" &&
        "then" in (resource as object)
      ) {
        const p = resource as ResolvedPromise<T>;
        if (p.__resolvedValue !== undefined) {
          return p.__resolvedValue;
        }
        return actual.use(resource as Promise<T>);
      }
      return actual.use(resource as Promise<T>);
    },
  };
});

const { mockUseProjectDetail, mockUseGates, mockRouterPush } = vi.hoisted(
  () => ({
    mockUseProjectDetail: vi.fn(),
    mockUseGates: vi.fn(),
    mockRouterPush: vi.fn(),
  }),
);

vi.mock("@/hooks/use-project-detail", () => ({
  useProjectDetail: (...args: unknown[]) => mockUseProjectDetail(...args),
}));

vi.mock("@/hooks/use-gates", () => ({
  useGates: (...args: unknown[]) => mockUseGates(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// 全局 antd App mock（与 setup.ts 一致）
vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  const AppWithMockedUseApp = Object.assign(actual.App, {
    useApp: vi.fn(() => ({
      message: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        loading: vi.fn(),
      },
      modal: { confirm: vi.fn() },
      notification: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
      },
    })),
  });
  return { ...actual, App: AppWithMockedUseApp };
});

import ProjectDetailPage from "@/app/(dashboard)/projects/[id]/page";

/** 构造项目 DTO */
function buildProject(
  overrides: Partial<{
    id: string;
    name: string;
    code: string;
    status: string;
  }> = {},
) {
  return {
    id: overrides.id ?? "proj-001",
    tenantId: "tenant-001",
    organizationId: null,
    code: overrides.code ?? "OFFICE-2026-001",
    name: overrides.name ?? "滨海办公大楼",
    description: null,
    status: overrides.status ?? "active",
    buildingType: "office",
    floorsMin: 5,
    floorsMax: 12,
    gfa: "10000",
    siteArea: "2000",
    region: "CN",
    language: "zh",
    classification: "CLASS_A",
    settings: {},
    metadata: {},
    startedAt: null,
    targetCompletionAt: null,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    createdBy: "user-001",
    updatedBy: "user-001",
    rowVersion: 1,
  };
}

/** 构造阶段实例 DTO */
function buildStage(
  overrides: Partial<{
    id: string;
    stageCode: string;
    stageName: string;
    stageOrder: number;
    status: string;
  }> = {},
) {
  return {
    id: overrides.id ?? "stage-001",
    tenantId: "tenant-001",
    projectId: "proj-001",
    stageCode: overrides.stageCode ?? "concept_design",
    stageName: overrides.stageName ?? "概念设计",
    stageOrder: overrides.stageOrder ?? 1,
    status: overrides.status ?? "in_progress",
    startedAt: null,
    completedAt: null,
    metadata: {},
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    rowVersion: 1,
  };
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    mockUseProjectDetail.mockReset();
    mockUseGates.mockReset();
    mockRouterPush.mockReset();
  });

  /**
   * 渲染页面
   *
   * 通过 createSyncResolvedPromise 缓存 Promise 解析值，配合 mock use() 同步取值，
   * 跳过 React 19 Suspense 边界，让测试在 jsdom 中可同步断言渲染结果
   */
  function renderPage(projectId = "proj-001") {
    return render(
      <Suspense fallback={<div>Loading</div>}>
        <ProjectDetailPage
          params={createSyncResolvedPromise({ id: projectId })}
        />
      </Suspense>,
    );
  }

  it("加载中应该渲染 Spin", async () => {
    mockUseProjectDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });
    mockUseGates.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    const { container } = renderPage();

    expect(container.querySelector(".ant-spin")).toBeInTheDocument();
    expect(container.querySelector(".ant-spin-lg")).toBeInTheDocument();
  });

  it("错误状态应该渲染 DataErrorAlert（result 模式）", async () => {
    mockUseProjectDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("网络断开"),
    });
    mockUseGates.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    await renderPage();

    // context="项目"，错误标题渲染
    expect(screen.getByText("项目加载失败")).toBeInTheDocument();
    expect(screen.getByText("网络断开")).toBeInTheDocument();
  });

  it("成功状态应该渲染项目头部、阶段时间线、门禁决策列表", async () => {
    mockUseProjectDetail.mockReturnValue({
      data: {
        project: buildProject({ name: "滨海办公大楼" }),
        stages: [
          buildStage({
            id: "stage-001",
            stageName: "概念设计",
            status: "in_progress",
          }),
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseGates.mockReturnValue({
      data: [],
      isLoading: false,
    });

    await renderPage();

    // 项目头部渲染（项目名称）
    expect(screen.getByText("滨海办公大楼")).toBeInTheDocument();
    // 阶段时间线渲染（阶段名称）
    expect(screen.getByText("概念设计")).toBeInTheDocument();
  });

  it("data 为 undefined 时应该走错误分支", async () => {
    mockUseProjectDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseGates.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    await renderPage();

    expect(screen.getByText("项目加载失败")).toBeInTheDocument();
  });

  it("应该渲染返回项目列表按钮", async () => {
    mockUseProjectDetail.mockReturnValue({
      data: {
        project: buildProject(),
        stages: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseGates.mockReturnValue({
      data: [],
      isLoading: false,
    });

    await renderPage();

    expect(screen.getByText("返回项目列表")).toBeInTheDocument();
  });

  it("点击返回项目列表按钮应该跳转", async () => {
    mockUseProjectDetail.mockReturnValue({
      data: {
        project: buildProject(),
        stages: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseGates.mockReturnValue({
      data: [],
      isLoading: false,
    });

    await renderPage();

    fireEvent.click(screen.getByText("返回项目列表"));

    expect(mockRouterPush).toHaveBeenCalledWith("/projects");
  });

  it("应该渲染设计选项/文档库/多专业协调按钮", async () => {
    mockUseProjectDetail.mockReturnValue({
      data: {
        project: buildProject(),
        stages: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseGates.mockReturnValue({
      data: [],
      isLoading: false,
    });

    await renderPage();

    expect(screen.getByText("设计选项")).toBeInTheDocument();
    expect(screen.getByText("文档库")).toBeInTheDocument();
    expect(screen.getByText("多专业协调")).toBeInTheDocument();
  });

  it("点击设计选项按钮应该跳转到设计选项页", async () => {
    mockUseProjectDetail.mockReturnValue({
      data: {
        project: buildProject(),
        stages: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseGates.mockReturnValue({
      data: [],
      isLoading: false,
    });

    await renderPage();

    fireEvent.click(screen.getByText("设计选项"));

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/projects/proj-001/design-options",
    );
  });

  it("点击文档库按钮应该跳转到文档库页", async () => {
    mockUseProjectDetail.mockReturnValue({
      data: {
        project: buildProject(),
        stages: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseGates.mockReturnValue({
      data: [],
      isLoading: false,
    });

    await renderPage();

    fireEvent.click(screen.getByText("文档库"));

    expect(mockRouterPush).toHaveBeenCalledWith("/projects/proj-001/documents");
  });

  it("点击多专业协调按钮应该跳转到协调页", async () => {
    mockUseProjectDetail.mockReturnValue({
      data: {
        project: buildProject(),
        stages: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseGates.mockReturnValue({
      data: [],
      isLoading: false,
    });

    await renderPage();

    fireEvent.click(screen.getByText("多专业协调"));

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/projects/proj-001/coordination",
    );
  });

  it("应该使用首个非 closed/cancelled 阶段查询门禁", async () => {
    mockUseProjectDetail.mockReturnValue({
      data: {
        project: buildProject(),
        stages: [
          buildStage({
            id: "stage-closed",
            stageName: "前期策划",
            stageOrder: 0,
            status: "closed",
          }),
          buildStage({
            id: "stage-active",
            stageName: "概念设计",
            stageOrder: 1,
            status: "in_progress",
          }),
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseGates.mockReturnValue({
      data: [],
      isLoading: false,
    });

    await renderPage();

    // useGates 应该传入 stage-active（首个非 closed/cancelled）
    expect(mockUseGates).toHaveBeenCalledWith("stage-active");
  });

  it("无活动阶段时 useGates 应该传入 null", async () => {
    mockUseProjectDetail.mockReturnValue({
      data: {
        project: buildProject(),
        stages: [
          buildStage({
            id: "stage-closed",
            status: "closed",
          }),
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseGates.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    await renderPage();

    // 无活动阶段时，useGates 传入 null
    expect(mockUseGates).toHaveBeenCalledWith(null);
  });
});
