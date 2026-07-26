/**
 * GoldenDatasetsPage 单元测试
 *
 * 验证：
 *  - 加载中状态：渲染 Spin（tip="加载数据集..."）
 *  - 错误状态：渲染 Alert（message="加载失败"）
 *  - 空状态：Table 渲染空
 *  - 成功状态：渲染 Table 与数据集数据
 *  - 标题与"创建数据集"按钮渲染
 *  - 点击"创建数据集"按钮打开弹窗
 *  - 点击"验证项"按钮跳转到 /golden-datasets/{id}
 *  - DRAFT 状态显示"冻结"按钮
 *  - FROZEN 状态显示"已冻结" Tag
 *  - 未知枚举值兜底显示原始值
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { mockUseQuery, mockUseMutation, mockUseQueryClient, mockRouterPush } =
  vi.hoisted(() => ({
    mockUseQuery: vi.fn(),
    mockUseMutation: vi.fn(),
    mockUseQueryClient: vi.fn(),
    mockRouterPush: vi.fn(),
  }));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient(),
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

import GoldenDatasetsPage from "@/app/(dashboard)/golden-datasets/page";

/** 构造数据集 DTO */
function buildDataset(
  overrides: Partial<{
    id: string;
    name: string;
    category: string;
    buildingType: string;
    version: string;
    fileCount: number;
    status: string;
    createdAt: string;
  }> = {},
) {
  return {
    id: overrides.id ?? "dataset-001",
    name: overrides.name ?? "办公楼金样 v1",
    description: "测试数据集",
    category: overrides.category ?? "ARCHITECTURE",
    buildingType: overrides.buildingType ?? "OFFICE_MEDIUM",
    version: overrides.version ?? "1.0.0",
    fileCount: overrides.fileCount ?? 12,
    totalSizeBytes: 1024,
    status: overrides.status ?? "DRAFT",
    storageKey: "golden-datasets/office-001",
    createdAt: overrides.createdAt ?? "2026-07-01T00:00:00Z",
  };
}

function buildMutationResult(
  overrides: Partial<{
    isPending: boolean;
    variables: unknown;
  }> = {},
) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: overrides.isPending ?? false,
    isError: false,
    isIdle: true,
    isPaused: false,
    isSuccess: false,
    variables: overrides.variables,
    data: undefined,
    error: null,
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    reset: vi.fn(),
    status: "idle" as const,
  };
}

function setupDefaultMocks() {
  mockUseMutation.mockReturnValue(buildMutationResult());
  mockUseQueryClient.mockReturnValue({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  });
}

describe("GoldenDatasetsPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockUseQueryClient.mockReset();
    mockRouterPush.mockReset();
    setupDefaultMocks();
  });

  it("加载中应该渲染 Spin", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = render(<GoldenDatasetsPage />);

    // Spin 组件渲染（tip 文案仅在嵌套模式下显示，通过 CSS 类验证）
    expect(container.querySelector(".ant-spin")).toBeInTheDocument();
  });

  it("错误状态应该渲染 Alert 并显示错误消息", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("网络断开"),
    });

    render(<GoldenDatasetsPage />);

    expect(screen.getByText("加载失败")).toBeInTheDocument();
    expect(screen.getByText("网络断开")).toBeInTheDocument();
  });

  it("成功状态应该渲染数据集列表", () => {
    mockUseQuery.mockReturnValue({
      data: [
        buildDataset({ id: "ds-001", name: "办公楼金样 v1" }),
        buildDataset({ id: "ds-002", name: "结构金样 v2" }),
      ],
      isLoading: false,
      error: null,
    });

    render(<GoldenDatasetsPage />);

    expect(screen.getByText("办公楼金样 v1")).toBeInTheDocument();
    expect(screen.getByText("结构金样 v2")).toBeInTheDocument();
  });

  it("空状态应该渲染 Table 但无数据集行", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<GoldenDatasetsPage />);

    // 标题仍渲染
    expect(screen.getByText("金样数据集管理")).toBeInTheDocument();
    // 表头渲染（名称列）
    expect(screen.getByText("名称")).toBeInTheDocument();
  });

  it("应该渲染标题与创建数据集按钮", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<GoldenDatasetsPage />);

    expect(screen.getByText("金样数据集管理")).toBeInTheDocument();
    expect(screen.getByText("创建数据集")).toBeInTheDocument();
  });

  it("点击创建数据集按钮应该打开弹窗", () => {
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<GoldenDatasetsPage />);

    fireEvent.click(screen.getByText("创建数据集"));

    // 弹窗标题
    expect(screen.getByText("创建金样数据集")).toBeInTheDocument();
    // 弹窗字段（"建筑类型"在表头与表单标签都出现，使用 getAllByText）
    expect(screen.getByText("数据集名称")).toBeInTheDocument();
    expect(screen.getByText("专业分类")).toBeInTheDocument();
    expect(screen.getAllByText("建筑类型").length).toBeGreaterThan(0);
    expect(screen.getByText("存储路径")).toBeInTheDocument();
  });

  it("点击验证项按钮应该跳转到数据集详情页", () => {
    mockUseQuery.mockReturnValue({
      data: [buildDataset({ id: "ds-001", name: "办公楼金样 v1" })],
      isLoading: false,
      error: null,
    });

    render(<GoldenDatasetsPage />);

    fireEvent.click(screen.getByText("验证项"));

    expect(mockRouterPush).toHaveBeenCalledWith("/golden-datasets/ds-001");
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });

  it("DRAFT 状态应该显示冻结按钮", () => {
    mockUseQuery.mockReturnValue({
      data: [buildDataset({ id: "ds-draft", status: "DRAFT" })],
      isLoading: false,
      error: null,
    });

    render(<GoldenDatasetsPage />);

    expect(screen.getByText("冻结")).toBeInTheDocument();
  });

  it("FROZEN 状态应该显示已冻结 Tag 而非冻结按钮", () => {
    mockUseQuery.mockReturnValue({
      data: [buildDataset({ id: "ds-frozen", status: "FROZEN" })],
      isLoading: false,
      error: null,
    });

    render(<GoldenDatasetsPage />);

    // FROZEN 状态显示"已冻结"Tag（在操作列与状态列都会出现，使用 getAllByText）
    expect(screen.getAllByText("已冻结").length).toBeGreaterThan(0);
    // 不应显示冻结按钮
    expect(screen.queryByText("冻结")).not.toBeInTheDocument();
  });

  it("未知分类枚举值应该兜底显示原始值", () => {
    mockUseQuery.mockReturnValue({
      data: [
        buildDataset({
          id: "ds-unknown-cat",
          category: "UNKNOWN_CATEGORY" as unknown as never,
        }),
      ],
      isLoading: false,
      error: null,
    });

    render(<GoldenDatasetsPage />);

    // 未知分类显示原始值
    expect(screen.getByText("UNKNOWN_CATEGORY")).toBeInTheDocument();
  });

  it("未知状态枚举值应该兜底显示原始值", () => {
    mockUseQuery.mockReturnValue({
      data: [
        buildDataset({
          id: "ds-unknown-status",
          status: "ARCHIVED" as unknown as never,
        }),
      ],
      isLoading: false,
      error: null,
    });

    render(<GoldenDatasetsPage />);

    // 未知状态显示原始值
    expect(screen.getAllByText("ARCHIVED").length).toBeGreaterThan(0);
  });

  it("未知建筑类型应该兜底显示原始值", () => {
    mockUseQuery.mockReturnValue({
      data: [
        buildDataset({
          id: "ds-unknown-bt",
          buildingType: "UNKNOWN_BUILDING_TYPE",
        }),
      ],
      isLoading: false,
      error: null,
    });

    render(<GoldenDatasetsPage />);

    expect(screen.getByText("UNKNOWN_BUILDING_TYPE")).toBeInTheDocument();
  });

  it("应该渲染分类与建筑类型标签", () => {
    mockUseQuery.mockReturnValue({
      data: [
        buildDataset({
          id: "ds-001",
          category: "STRUCTURE",
          buildingType: "OFFICE_SMALL",
        }),
      ],
      isLoading: false,
      error: null,
    });

    render(<GoldenDatasetsPage />);

    expect(screen.getByText("结构")).toBeInTheDocument();
    expect(screen.getByText("小型办公（5-8层）")).toBeInTheDocument();
  });
});
