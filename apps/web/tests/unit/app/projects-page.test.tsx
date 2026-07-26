/**
 * ProjectsPage 单元测试
 *
 * 验证：
 *  - 加载中状态（列表视图）：渲染 Spin
 *  - 错误状态（列表视图）：渲染 DataErrorAlert（context="项目列表"）
 *  - 卡片视图：渲染项目卡片、状态 Tag
 *  - 列表视图：渲染 Table
 *  - 视图切换：卡片 <-> 列表
 *  - 空状态：渲染 Empty
 *  - 统计：active / completed / on_hold 数量
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { mockUseProjects, mockRouterPush, mockSearchParams } = vi.hoisted(
  () => ({
    mockUseProjects: vi.fn(),
    mockRouterPush: vi.fn(),
    mockSearchParams: vi.fn(),
  }),
);

vi.mock("@/hooks/use-projects", () => ({
  useProjects: (...args: unknown[]) => mockUseProjects(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => mockSearchParams(),
}));

vi.mock("@/components/project/create-project-modal", () => ({
  CreateProjectModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-project-modal">Modal</div> : null,
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

import ProjectsPage from "@/app/(dashboard)/projects/page";

/** 构造项目 DTO */
function buildProject(
  overrides: Partial<{
    id: string;
    name: string;
    code: string;
    status: "active" | "on_hold" | "completed" | "cancelled" | "archived";
    buildingType: "office" | "residential" | "commercial" | "mixed";
    floorsMin: number;
    floorsMax: number;
  }> = {},
) {
  return {
    id: overrides.id ?? "proj-001",
    name: overrides.name ?? "滨海办公大楼",
    code: overrides.code ?? "OFFICE-001",
    status: overrides.status ?? "active",
    buildingType: overrides.buildingType ?? "office",
    floorsMin: overrides.floorsMin ?? 5,
    floorsMax: overrides.floorsMax ?? 12,
    rowVersion: 1,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };
}

function buildPage(items: ReturnType<typeof buildProject>[] = []) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 10,
    hasMore: false,
  };
}

function mockSearchParamsEmpty() {
  mockSearchParams.mockReturnValue({
    get: () => null,
  });
}

/** 切换到列表视图 */
function switchToTableView() {
  fireEvent.click(screen.getByText("列表视图"));
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    mockUseProjects.mockReset();
    mockRouterPush.mockReset();
    mockSearchParamsEmpty();
  });

  it("列表视图加载中应该渲染 Spin", () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      isFetching: false,
    });

    const { container } = render(<ProjectsPage />);
    // 切换到列表视图才能看到 Spin
    switchToTableView();

    expect(container.querySelector(".ant-spin")).toBeInTheDocument();
  });

  it("列表视图错误状态应该渲染 DataErrorAlert", () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("网络断开"),
      isFetching: false,
    });

    render(<ProjectsPage />);
    switchToTableView();

    expect(screen.getByText("项目列表加载失败")).toBeInTheDocument();
    expect(screen.getByText("网络断开")).toBeInTheDocument();
  });

  it("卡片视图应该渲染项目卡片", () => {
    mockUseProjects.mockReturnValue({
      data: buildPage([
        buildProject({
          id: "p1",
          name: "项目Alpha",
          code: "ALPHA-001",
          status: "active",
        }),
        buildProject({
          id: "p2",
          name: "项目Beta",
          code: "BETA-001",
          status: "completed",
        }),
      ]),
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    });

    render(<ProjectsPage />);

    expect(screen.getByText("项目Alpha")).toBeInTheDocument();
    expect(screen.getByText("ALPHA-001")).toBeInTheDocument();
    expect(screen.getByText("项目Beta")).toBeInTheDocument();
    expect(screen.getByText("BETA-001")).toBeInTheDocument();
  });

  it("卡片视图应该渲染状态 Tag 标签", () => {
    mockUseProjects.mockReturnValue({
      data: buildPage([
        buildProject({ id: "p1", status: "active" }),
        buildProject({ id: "p2", status: "on_hold" }),
      ]),
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    });

    render(<ProjectsPage />);

    // Active 状态 Tag
    expect(screen.getByText("Active")).toBeInTheDocument();
    // "On Hold" 既是状态 Tag 又是 Statistic 标题，使用 getAllByText
    expect(screen.getAllByText("On Hold").length).toBeGreaterThan(0);
  });

  it("空项目列表（卡片视图）应该渲染 Empty", () => {
    mockUseProjects.mockReturnValue({
      data: buildPage([]),
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    });

    render(<ProjectsPage />);

    expect(screen.getAllByText(/暂无项目/).length).toBeGreaterThan(0);
  });

  it("切换到列表视图应该渲染 Table 表头", () => {
    mockUseProjects.mockReturnValue({
      data: buildPage([
        buildProject({ id: "p1", name: "项目Alpha", code: "ALPHA-001" }),
      ]),
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    });

    render(<ProjectsPage />);
    switchToTableView();

    // Table 表头列（antd Table header 可能渲染多份文本，使用 getAllByText）
    expect(screen.getAllByText("Name").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Building Type").length).toBeGreaterThan(0);
  });

  it("卡片视图点击项目卡片应该跳转详情页", () => {
    mockUseProjects.mockReturnValue({
      data: buildPage([
        buildProject({ id: "p1", name: "项目Alpha", code: "ALPHA-001" }),
      ]),
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    });

    render(<ProjectsPage />);

    fireEvent.click(screen.getByText("项目Alpha"));

    expect(mockRouterPush).toHaveBeenCalledWith("/projects/p1");
  });

  it("点击'新建项目'按钮应该打开 CreateProjectModal", () => {
    mockUseProjects.mockReturnValue({
      data: buildPage([]),
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    });

    render(<ProjectsPage />);

    fireEvent.click(screen.getByText("新建项目"));

    expect(screen.getByTestId("create-project-modal")).toBeInTheDocument();
  });

  it("统计区域应该显示 Active Projects 标题", () => {
    mockUseProjects.mockReturnValue({
      data: buildPage([
        buildProject({ id: "p1", status: "active" }),
        buildProject({ id: "p2", status: "active" }),
        buildProject({ id: "p3", status: "completed" }),
        buildProject({ id: "p4", status: "on_hold" }),
      ]),
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    });

    render(<ProjectsPage />);

    // 统计区域标题
    expect(screen.getByText("Active Projects")).toBeInTheDocument();
    // "Completed" / "On Hold" 既是状态 Tag 又是 Statistic 标题，使用 getAllByText
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("On Hold").length).toBeGreaterThan(0);
  });

  it("应该调用 useProjects 传入分页参数", () => {
    mockUseProjects.mockReturnValue({
      data: buildPage([]),
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    });

    render(<ProjectsPage />);

    expect(mockUseProjects).toHaveBeenCalled();
    const args = mockUseProjects.mock.calls[0]?.[0] as {
      page: number;
      pageSize: number;
    };
    expect(args.page).toBe(1);
    expect(args.pageSize).toBe(10);
  });

  it("应该从 URL 搜索参数读取初始 keyword", () => {
    mockSearchParams.mockReturnValue({
      get: (key: string) => (key === "keyword" ? "测试关键词" : null),
    });

    mockUseProjects.mockReturnValue({
      data: buildPage([]),
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    });

    render(<ProjectsPage />);

    const input = screen.getByPlaceholderText(
      "搜索项目编码或名称",
    ) as HTMLInputElement;
    expect(input.value).toBe("测试关键词");
  });

  it("应该渲染页面标题 Projects", () => {
    mockUseProjects.mockReturnValue({
      data: buildPage([]),
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    });

    render(<ProjectsPage />);

    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("卡片视图与列表视图应该可来回切换", () => {
    mockUseProjects.mockReturnValue({
      data: buildPage([
        buildProject({ id: "p1", name: "项目Alpha", code: "ALPHA-001" }),
      ]),
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    });

    render(<ProjectsPage />);

    // 卡片视图：渲染项目名
    expect(screen.getByText("项目Alpha")).toBeInTheDocument();

    // 切换到列表视图：渲染 Table 表头
    switchToTableView();
    expect(screen.getAllByText("Name").length).toBeGreaterThan(0);

    // 切换回卡片视图
    fireEvent.click(screen.getByText("卡片视图"));
    expect(screen.getByText("项目Alpha")).toBeInTheDocument();
  });

  it("列表视图空数据应该渲染 Empty 提示", () => {
    mockUseProjects.mockReturnValue({
      data: buildPage([]),
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    });

    render(<ProjectsPage />);
    switchToTableView();

    // Table 空状态文案
    expect(screen.getAllByText(/暂无项目/).length).toBeGreaterThan(0);
  });
});
